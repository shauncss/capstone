import socket

# Your PC's hostname, appended with .local
HOSTNAME_LOCAL = "LAPTOP-OCP2J7E0.local"

print(f"Attempting to resolve hostname: {HOSTNAME_LOCAL}...")

try:
    # The socket library attempts to resolve the name to an IP address
    # This uses your system's underlying DNS/mDNS resolver.
    ip_address = socket.gethostbyname(HOSTNAME_LOCAL)
    
    print("\n✅ RESOLUTION SUCCESSFUL!")
    print(f"Hostname: {HOSTNAME_LOCAL}")
    print(f"IP Address: {ip_address}")
    
    # You can use this dynamic IP in your BASE_URL
    NEW_BASE_URL = f"http://{ip_address}:5173/?"
    print(f"\nYour new dynamic BASE_URL would be: {NEW_BASE_URL}")
    
except socket.gaierror:
    print("\n❌ RESOLUTION FAILED.")
    print(f"Could not find the IP address for {HOSTNAME_LOCAL}.")
    print("This confirms mDNS/Zeroconf is likely not working reliably.")

except Exception as e:
    print(f"\nAn unexpected error occurred: {e}")
