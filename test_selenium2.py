import urllib.request
try:
    urllib.request.urlopen("http://localhost:3000")
    print("Server is accessible!")
except Exception as e:
    print("Could not reach server:", e)
