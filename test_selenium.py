import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

chrome_options = Options()
chrome_options.add_argument('--headless')
chrome_options.add_argument('--no-sandbox')
chrome_options.add_argument('--disable-dev-shm-usage')
chrome_options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(options=chrome_options)
driver.get("http://localhost:3000")

time.sleep(3)

# find the gallery tab and click it
try:
    script = "document.querySelector('button[data-bs-target=\"#gallery-content\"]').click();"
    driver.execute_script(script)
    time.sleep(3)
except Exception as e:
    print("Could not click gallery tab:", e)

# get logs
logs = driver.get_log('browser')
for log in logs:
    if log['level'] in ['SEVERE', 'WARNING']:
        print(f"[{log['level']}] {log['message']}")
    if 'DEBUG-GALLERY' in log['message']:
        print(f"[DEBUG-GALLERY] {log['message']}")

driver.quit()
