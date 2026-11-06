import sys, tempfile, json
from pathlib import Path
from unittest.mock import patch
from PIL import Image
sys.path.insert(0,str(Path(__file__).parent))
import publica_lucrari as pub
source = json.loads(Path(__file__).with_name('catalog_exemplu_6_lucrari.json').read_text())
with tempfile.TemporaryDirectory() as temp:
 root=Path(temp);incoming=root/'incoming';incoming.mkdir();Image.new('RGB',(80,100),'red').save(incoming/'si-0003.jpg')
 args=['--input',str(incoming),'--state',str(root/'state'/'publicate.json'),'--logs',str(root/'logs'),'--output',str(root/'output')]
 with patch.object(pub,'load_base_catalog',return_value=source),patch.object(pub,'choose_category',return_value='graphics'),patch.object(pub,'prompt',return_value='si-0033'),patch.object(pub,'yesno',return_value=True):
  assert pub.main(args)==0
 state=json.loads((root/'state'/'publicate.json').read_text())
 assert len(state['published'])==1
 assert list(state['published'].values())[0]['id']=='si-0033'
 with patch.object(pub,'load_base_catalog',return_value=source),patch.object(pub,'choose_category',side_effect=Exception('should not ask')):
  assert pub.main(args)==0
 print('PASS: prior filename si-0003 recognized as existing si-0033 and remembered')
