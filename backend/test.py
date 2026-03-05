import json, re
raw = open("json.txt").read()
match = re.search(r"google\.visualization\.Query\.setResponse\((.*)\);?\s*$", raw, re.DOTALL)
data = json.loads(match.group(1) if match else raw)
types = set()
for row in data["table"]["rows"]:
    cells = row.get("c", [])
    v = cells[12].get("v") if len(cells) > 12 and cells[12] else None
    if v: types.add(v)
print(types)
