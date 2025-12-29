import os
import sys
import argparse
import glob
import time
import threading
import copy

import cv2
import numpy as np
from ultralytics import YOLO

def iou(boxA, boxB):
    # boxes are (xmin, ymin, xmax, ymax)
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interW = max(0, xB - xA)
    interH = max(0, yB - yA)
    interArea = interW * interH
    boxAArea = max(0, boxA[2] - boxA[0]) * max(0, boxA[3] - boxA[1])
    boxBArea = max(0, boxB[2] - boxB[0]) * max(0, boxB[3] - boxB[1])
    denom = float(boxAArea + boxBArea - interArea)
    if denom <= 0:
        return 0.0
    return interArea / denom


class StickyTracker:
    def __init__(self, iou_threshold=0.3, max_age=1.0):
        self.next_id = 1
        self.tracks = {}  # id -> {bbox, class, conf, last_seen}
        self.iou_th = iou_threshold
        self.max_age = max_age

    def update(self, detections):
        # detections: list of dict {'bbox':(xmin,ymin,xmax,ymax),'class':name,'conf':float}
        now = time.time()
        new_tracks = {}

        used_new = set()
        # Match existing tracks to new detections by IoU
        for tid, t in list(self.tracks.items()):
            best_iou = 0.0
            best_j = None
            for j, det in enumerate(detections):
                if j in used_new:
                    continue
                val = iou(t['bbox'], det['bbox'])
                if val > best_iou:
                    best_iou = val
                    best_j = j
            if best_j is not None and best_iou >= self.iou_th:
                det = detections[best_j]
                new_tracks[tid] = {'bbox': det['bbox'], 'class': det['class'], 'conf': det['conf'], 'last_seen': now}
                used_new.add(best_j)
            else:
                # keep old track until it ages out
                age = now - t['last_seen']
                if age <= self.max_age:
                    new_tracks[tid] = t

        # Add unmatched detections as new tracks
        for j, det in enumerate(detections):
            if j in used_new:
                continue
            tid = self.next_id
            self.next_id += 1
            new_tracks[tid] = {'bbox': det['bbox'], 'class': det['class'], 'conf': det['conf'], 'last_seen': now}

        self.tracks = new_tracks

    def get_active(self):
        now = time.time()
        return {tid: t for tid, t in self.tracks.items() if now - t['last_seen'] <= self.max_age}


def main():
    parser = argparse.ArgumentParser()
    # model, source and resolution are hardcoded below
    parser.add_argument('--thresh', type=float, default=0.5, help='min confidence')
    parser.add_argument('--record', action='store_true', help='record output')
    parser.add_argument('--target-fps', type=float, default=14.0, help='display FPS target')
    parser.add_argument('--infer-fps', type=float, default=1.0, help='inference thread FPS')
    parser.add_argument('--max-age', type=float, default=1.0, help='sticky bbox max age in seconds')
    args = parser.parse_args()

    # Hardcoded defaults requested by user
    model_path = 'best_ncnn_model'
    img_source = 'picamera0'
    # Default display resolution (W x H) — adjust here if you want a different fixed resolution
    user_res = '1280x720'

    min_thresh = args.thresh
    record = args.record
    target_fps = float(args.target_fps)
    infer_fps = float(args.infer_fps)
    max_age = float(args.max_age)

    if not os.path.exists(model_path):
        print('ERROR: model path invalid')
        sys.exit(1)

    model = YOLO(model_path, task='detect')
    labels = model.names

    img_ext_list = ['.jpg','.JPG','.jpeg','.JPEG','.png','.PNG','.bmp','.BMP']
    vid_ext_list = ['.avi','.mov','.mp4','.mkv','.wmv']

    if os.path.isdir(img_source):
        source_type = 'folder'
    elif os.path.isfile(img_source):
        _, ext = os.path.splitext(img_source)
        if ext in img_ext_list:
            source_type = 'image'
        elif ext in vid_ext_list:
            source_type = 'video'
        else:
            print('unsupported file extension')
            sys.exit(1)
    elif 'usb' in img_source:
        source_type = 'usb'
        usb_idx = int(img_source[3:])
    elif 'picamera' in img_source:
        source_type = 'picamera'
        picam_idx = int(img_source[8:])
    else:
        print('invalid input')
        sys.exit(1)

    resize = False
    if user_res:
        resize = True
        resW, resH = int(user_res.split('x')[0]), int(user_res.split('x')[1])

    if record and source_type not in ['video', 'usb']:
        print('record works only for video/usb')
        sys.exit(1)

    if source_type == 'image':
        imgs_list = [img_source]
    elif source_type == 'folder':
        imgs_list = []
        filelist = glob.glob(img_source + '/*')
        for file in filelist:
            _, file_ext = os.path.splitext(file)
            if file_ext in img_ext_list:
                imgs_list.append(file)
    elif source_type in ['video', 'usb']:
        cap_arg = img_source if source_type == 'video' else usb_idx
        cap = cv2.VideoCapture(cap_arg)
        if user_res:
            cap.set(3, resW)
            cap.set(4, resH)
    elif source_type == 'picamera':
        from picamera2 import Picamera2
        cap = Picamera2()
        cap.configure(cap.create_video_configuration(main={"format": 'XRGB8888', "size": (resW, resH)}))
        cap.start()

    # Define exactly one distinct color per class (two colors expected)
    # Use BGR tuples
    CLASS_COLOR_LIST = [(0, 0, 255), (0, 255, 0)]  # red, green
    # Build map from class name -> color (deterministic from model labels)
    class_color_map = {}
    for idx, name in labels.items():
        class_color_map[name] = CLASS_COLOR_LIST[idx % len(CLASS_COLOR_LIST)]

    latest_frame = {'img': None, 'lock': threading.Lock()}
    detections_shared = {'tracks': {}, 'lock': threading.Lock()}
    tracker = StickyTracker(iou_threshold=0.3, max_age=max_age)
    stop_event = threading.Event()

    def inference_thread_fn():
        nonlocal latest_frame, detections_shared, tracker
        sleep_target = 1.0 / max(0.0001, infer_fps)
        while not stop_event.is_set():
            t0 = time.perf_counter()
            with latest_frame['lock']:
                frame = None if latest_frame['img'] is None else latest_frame['img'].copy()
            if frame is None:
                time.sleep(0.01)
                continue

            # Run model inference on a copy
            results = model(frame, verbose=False)
            detections = []
            if len(results) > 0:
                boxes = results[0].boxes
                for i in range(len(boxes)):
                    xyxy = boxes[i].xyxy.cpu().numpy().squeeze().astype(int)
                    xmin, ymin, xmax, ymax = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                    classidx = int(boxes[i].cls.item())
                    classname = labels[classidx]
                    conf = boxes[i].conf.item()
                    if conf >= min_thresh:
                        detections.append({'bbox': (xmin, ymin, xmax, ymax), 'class': classname, 'conf': conf})

            # Update tracker and shared detections
            tracker.update(detections)
            active = tracker.get_active()
            with detections_shared['lock']:
                detections_shared['tracks'] = copy.deepcopy(active)

            t1 = time.perf_counter()
            elapsed = t1 - t0
            to_sleep = sleep_target - elapsed
            if to_sleep > 0:
                time.sleep(to_sleep)

    inf_thread = threading.Thread(target=inference_thread_fn, daemon=True)
    inf_thread.start()

    # Optional recorder
    if record:
        if not user_res:
            print('Please specify resolution to record')
            stop_event.set(); inf_thread.join()
            sys.exit(1)
        record_name = 'demo_lite.avi'
        recorder = cv2.VideoWriter(record_name, cv2.VideoWriter_fourcc(*'MJPG'), int(target_fps), (resW, resH))
    else:
        recorder = None

    try:
        img_count = 0
        fps_buf = []
        fps_buf_len = 50
        # Cap video feed reads to target FPS by scheduling next frame time
        next_frame_time = time.perf_counter()
        while True:
            t_start = time.perf_counter()
            # wait until next scheduled frame time (cap camera/read rate)
            if t_start < next_frame_time:
                time.sleep(max(0.0, next_frame_time - t_start))
                t_start = time.perf_counter()

            # Read frame
            if source_type in ['image', 'folder']:
                if img_count >= len(imgs_list):
                    print('Done processing images')
                    break
                img_filename = imgs_list[img_count]
                frame = cv2.imread(img_filename)
                img_count += 1
            elif source_type == 'video' or source_type == 'usb':
                ret, frame = cap.read()
                if not ret or frame is None:
                    print('No frame, exiting')
                    break
            elif source_type == 'picamera':
                frame_bgra = cap.capture_array()
                frame = cv2.cvtColor(np.copy(frame_bgra), cv2.COLOR_BGRA2BGR)

            if resize:
                frame = cv2.resize(frame, (resW, resH))

            # Publish latest frame for inference thread
            with latest_frame['lock']:
                latest_frame['img'] = frame.copy()

            # Draw sticky boxes from shared detections
            with detections_shared['lock']:
                tracks = copy.deepcopy(detections_shared['tracks'])

            # Draw one colored box per class and show only the class name (no confidence)
            for tid, t in tracks.items():
                xmin, ymin, xmax, ymax = t['bbox']
                class_name = t['class']
                # pick color for the class
                color = class_color_map.get(class_name, CLASS_COLOR_LIST[0])
                cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), color, 2)
                label = f'{class_name}'
                # larger, bolder text
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 1.0
                font_thickness = 2
                labelSize, baseLine = cv2.getTextSize(label, font, font_scale, font_thickness)
                label_ymin = max(ymin, labelSize[1] + 10)
                cv2.rectangle(frame, (xmin, label_ymin-labelSize[1]-10), (xmin+labelSize[0], label_ymin+baseLine-10), color, cv2.FILLED)
                # draw bold text (thicker stroke)
                cv2.putText(frame, label, (xmin, label_ymin-7), font, font_scale, (0,0,0), font_thickness)

            # Draw FPS and object count
            fps = 0.0
            if len(fps_buf) > 0:
                fps = sum(fps_buf)/len(fps_buf)
            cv2.putText(frame, f'FPS: {fps:0.2f}', (10,20), cv2.FONT_HERSHEY_SIMPLEX, .7, (0,255,255), 2)
            cv2.putText(frame, f'Objects: {len(tracks)}', (10,40), cv2.FONT_HERSHEY_SIMPLEX, .7, (0,255,255), 2)

            cv2.imshow('YOLO Lite', frame)
            if recorder is not None:
                recorder.write(frame)

            # Input handling
            key = cv2.waitKey(1)
            if key == ord('q') or key == ord('Q'):
                break
            elif key == ord('s') or key == ord('S'):
                cv2.waitKey()
            elif key == ord('p') or key == ord('P'):
                cv2.imwrite('capture_lite.png', frame)

            # Maintain display target FPS
            t_stop = time.perf_counter()
            frame_time = t_stop - t_start
            fps_buf.append(1.0/frame_time if frame_time > 0 else 0.0)
            if len(fps_buf) > fps_buf_len:
                fps_buf.pop(0)
            # schedule next frame time and sleep if needed to hit target FPS
            next_frame_time = t_start + (1.0 / max(0.0001, target_fps))
            sleep_time = next_frame_time - time.perf_counter()
            if sleep_time > 0:
                time.sleep(sleep_time)

    finally:
        stop_event.set()
        inf_thread.join()
        print('Cleaning up...')
        if source_type in ['video', 'usb']:
            cap.release()
        elif source_type == 'picamera':
            cap.stop()
        if recorder is not None:
            recorder.release()
        cv2.destroyAllWindows()


if __name__ == '__main__':
    main()
