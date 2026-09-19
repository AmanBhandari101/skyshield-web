"""Check that the partner form on partner.html can still get entries into its Google Sheet.

The page posts straight into a Google Form through a hidden iframe. Google's reply can't be read cross-origin, so
the page says "Sent" whatever happens. When the form stops accepting responses, or its questions change, entries
are silently dropped. That happened once, unnoticed, until the sheet was found to be missing rows. This script
fails loudly instead; run daily by .github/workflows/partner-form-check.yml, a failure makes GitHub email the owner.

Everything is read from partner.html itself (the form's action URL and the entry.NNN names the page posts), so the
check follows the page if the form is ever swapped. Checks:
  1. the form is open: Google sends a closed form to .../closedform
  2. it does not require signing in
  3. every entry.NNN the page posts is still a question on the form
  4. every required question on the form is one the page fills in, or Google rejects every website entry

Read-only: it only fetches the form's public page and never submits anything.
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
FIX_CLOSED = ("Open the form in Google Forms > Responses and switch 'Accepting responses' back on. "
              "Entries sent while it was closed were never stored.")


def fail(msg):
    print("FAIL: " + msg)
    sys.exit(1)


page = (ROOT / "partner.html").read_text(encoding="utf-8")
form = re.search(r'<form\b[^>]*\bid="partnerForm"[^>]*>', page, re.S)
if not form:
    fail("no <form id=\"partnerForm\"> in partner.html")
action = re.search(r'action="(https://docs\.google\.com/forms/d/e/([\w-]+)/formResponse)"', form.group(0))
if not action:
    fail("partnerForm's action is not a Google Forms formResponse URL")
form_id = action.group(2)
posted = sorted(set(re.findall(r'name="entry\.(\d+)"', page)))
print("partner.html posts to form %s, fields %s" % (form_id, ", ".join("entry." + p for p in posted)))

view = "https://docs.google.com/forms/d/e/%s/viewform" % form_id
html = final = None
for attempt in range(3):                                   # a single network blip shouldn't send an alarm email
    try:
        with urllib.request.urlopen(urllib.request.Request(view, headers={"User-Agent": UA}), timeout=30) as r:
            final, html = r.geturl(), r.read().decode("utf-8", "replace")
        break
    except Exception as e:                                 # noqa: BLE001 -- report whatever went wrong
        if attempt == 2:
            fail("could not load %s: %s" % (view, e))
        time.sleep(10)

if "/closedform" in final or "no longer accepting responses" in html:
    fail("the Google Form is CLOSED (not accepting responses) -- every website entry is being dropped. " + FIX_CLOSED)
if "accounts.google.com" in final or "ServiceLogin" in final:
    fail("the Google Form now requires signing in, so anonymous website entries are rejected. "
         "In the form's Settings > Responses, turn off sign-in / 'Restrict to users in ...'.")

m = re.search(r"FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.*?\]);\s*</script>", html, re.S)
if not m:
    fail("the form page loaded (%s) but has no question data -- is it still published?" % final)
data = json.loads(m.group(1))
questions = {}                                              # entry id -> (title, required)
for item in data[1][1] or []:
    for part in (item[4] if len(item) > 4 and item[4] else []):
        questions[str(part[0])] = (item[1], bool(part[2]))

missing = [p for p in posted if p not in questions]
if missing:
    fail("the page posts %s, which the form no longer has (a question was deleted or recreated). Update the "
         "name= attributes in partner.html from the form's current questions." % ", ".join("entry." + p for p in missing))
unfilled = ["'%s' (entry.%s)" % (t, e) for e, (t, req) in questions.items() if req and e not in posted]
if unfilled:
    fail("the form has required question(s) the page never fills in: %s. Google rejects every website entry "
         "until they are made optional or added to the page." % ", ".join(unfilled))

print("OK: form is open, no sign-in, all %d posted fields exist, no unfilled required questions (%d on the form)."
      % (len(posted), len(questions)))
