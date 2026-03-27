#!/usr/bin/env python3
"""
Pre-upload script to kill minicom before flashing.
Prevents "Address already in use" errors on serial port.
"""
import os
import subprocess
import sys

def kill_minicom():
    """Kill all minicom processes."""
    try:
        # Use pkill to terminate minicom gracefully
        result = subprocess.run(['pkill', '-f', 'minicom'], 
                              capture_output=True, 
                              text=True,
                              timeout=5)
        
        if result.returncode == 0:
            print("[Pre-Upload] Minicom terminated successfully")
            return True
        else:
            # pkill returns 1 if no matching process found (which is fine)
            print("[Pre-Upload] No minicom process found (or already terminated)")
            return True
    except FileNotFoundError:
        print("[Pre-Upload] Warning: pkill not found, trying killall...")
        try:
            subprocess.run(['killall', 'minicom'], 
                         capture_output=True,
                         timeout=5)
            print("[Pre-Upload] Minicom terminated via killall")
            return True
        except Exception as e:
            print(f"[Pre-Upload] Warning: Could not kill minicom: {e}")
            return True
    except Exception as e:
        print(f"[Pre-Upload] Error: {e}")
        return False

if __name__ == "__main__":
    print("[Pre-Upload] Checking for running minicom instances...")
    success = kill_minicom()
    sys.exit(0 if success else 1)
