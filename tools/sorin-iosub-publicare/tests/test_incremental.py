import tempfile, json, os, sys, types, importlib.util, hashlib
from pathlib import Path
from unittest.mock import patch
from PIL import Image
sys.path.insert(0,str(Path(__file__).parent))
import publica_lucrari as pub

class Body:
 def __init__(self,data):self.data=data
 def read(self):return self.data
class FakeR2:
 def __init__(self,base):
  self.catalogue=json.dumps(base).encode('utf-8');self.files={};self.upload_count=0;self.json_count=0;self.fail_once=False
 def get_object(self, Bucket, Key):
  assert Bucket==pub.BUCKET and Key=='data/artworks.json'
  return {'Body':Body(self.catalogue)}
 def upload_file(self, path, bucket, key, ExtraArgs):
  self.upload_count+=1;self.files[key]=Path(path).read_bytes()
 def put_object(self, Bucket, Key, Body, ContentType, CacheControl):
  if self.fail_once:
   self.fail_once=False
   raise RuntimeError('test interruption during JSON publishing')
  self.json_count+=1;self.catalogue=Body

def put_image(path, color):
 Image.new('RGB',(95,60),color).save(path,'JPEG')

def run(tmp,r2,answer_category='graphics'):
 answers=iter(['2','3','1'])
 def category():
  try: return next(answers)
  except StopIteration: return '2'
 # Need correct category string rather than category UI index.
 return pub.main(['--input',str(tmp/'incoming'),'--state',str(tmp/'state'/'publicate.json'), '--logs',str(tmp/'logs'), '--output',str(tmp/'output')])

source=json.loads(Path(__file__).with_name('catalog_exemplu_6_lucrari.json').read_text(encoding='utf8'))
with tempfile.TemporaryDirectory() as td:
 t=Path(td); incoming=t/'incoming';incoming.mkdir()
 put_image(incoming/'si-0004.jpg','red') # already catalogued, skip automatically
 put_image(incoming/'si-0700.jpg','blue') # new
 state=t/'state'/'publicate.json'
 r2=FakeR2(source)
 def base(_path):return json.loads(r2.catalogue)
 # choose category only for new (one prompt)
 with patch.object(pub,'load_base_catalog',side_effect=base),patch.object(pub,'choose_category',return_value='graphics') as choose,patch.object(pub,'prompt',side_effect=lambda m,default=None: default if default is not None else ''),patch.object(pub,'yesno',side_effect=[False, True, True]),patch.object(pub,'r2_client',return_value=r2):
  assert pub.main(['--input',str(incoming),'--state',str(state),'--logs',str(t/'logs'),'--output',str(t/'output')])==0
  assert choose.call_count==1,choose.call_count
 assert r2.upload_count==2,r2.upload_count
 assert r2.json_count==1
 assert len(json.loads(r2.catalogue)['artworks'])==7
 assert len(json.loads(state.read_text())['published'])==1
 first_log=(t/'logs'/'publicari.csv').read_text(encoding='utf-8-sig')
 assert 'skipped_existing_id' in first_log and 'published' in first_log
 old_uploads=r2.upload_count
 with patch.object(pub,'load_base_catalog',side_effect=base),patch.object(pub,'choose_category',side_effect=Exception('should not be asked')):
  assert pub.main(['--input',str(incoming),'--state',str(state),'--logs',str(t/'logs'),'--output',str(t/'output')])==0
 assert old_uploads==r2.upload_count
 put_image(incoming/'si-0701.jpg','green')
 with patch.object(pub,'load_base_catalog',side_effect=base),patch.object(pub,'choose_category',return_value='frescoes') as choose,patch.object(pub,'prompt',side_effect=lambda m,default=None:default if default is not None else ''),patch.object(pub,'yesno',side_effect=[False, True, True]),patch.object(pub,'r2_client',return_value=r2):
  assert pub.main(['--input',str(incoming),'--state',str(state),'--logs',str(t/'logs'),'--output',str(t/'output')])==0
  assert choose.call_count==1
 assert r2.upload_count==4 and r2.json_count==2
 assert len(json.loads(state.read_text())['published'])==2
 assert len(json.loads(r2.catalogue)['artworks'])==8
 # Duplicate identical content under new name must be skipped; no prompts.
 (incoming/'copy_new_name.jpg').write_bytes((incoming/'si-0700.jpg').read_bytes())
 with patch.object(pub,'load_base_catalog',side_effect=base),patch.object(pub,'choose_category',side_effect=Exception('should not be asked')):
  assert pub.main(['--input',str(incoming),'--state',str(state),'--logs',str(t/'logs'),'--output',str(t/'output')])==0
 assert r2.upload_count==4
 # CSV must have one BOM only despite many log appends.
 raw=(t/'logs'/'publicari.csv').read_bytes();assert raw.count(b'\xef\xbb\xbf')==1,raw.count(b'\xef\xbb\xbf')
 # Simulate failed JSON put: must not mark image as published, then recover cleanly.
 put_image(incoming/'si-0702.jpg','yellow');r2.fail_once=True
 try:
  with patch.object(pub,'load_base_catalog',side_effect=base),patch.object(pub,'choose_category',return_value='paintings'),patch.object(pub,'prompt',side_effect=lambda m,default=None:default if default is not None else ''),patch.object(pub,'yesno',side_effect=[False, True, True]),patch.object(pub,'r2_client',return_value=r2):
   pub.main(['--input',str(incoming),'--state',str(state),'--logs',str(t/'logs'),'--output',str(t/'output')])
 except RuntimeError as exc:
  assert 'test interruption' in str(exc)
 else:raise AssertionError('Expected R2 failure')
 assert len(json.loads(state.read_text())['published'])==2
 assert len(json.loads(r2.catalogue)['artworks'])==8
 with patch.object(pub,'load_base_catalog',side_effect=base),patch.object(pub,'choose_category',return_value='paintings'),patch.object(pub,'prompt',side_effect=lambda m,default=None:default if default is not None else ''),patch.object(pub,'yesno',side_effect=[False, True, True]),patch.object(pub,'r2_client',return_value=r2):
  assert pub.main(['--input',str(incoming),'--state',str(state),'--logs',str(t/'logs'),'--output',str(t/'output')])==0
 assert len(json.loads(state.read_text())['published'])==3
 assert len(json.loads(r2.catalogue)['artworks'])==9
 # Corrupted history must prevent processing.
 state.write_text('{ broken',encoding='utf-8')
 try:pub.load_state(state)
 except RuntimeError:pass
 else:raise AssertionError('Invalid state not blocked')
 print('PASS: existing catalog images skipped, hash-based history, next-run only new, SHA duplicates, error recovery, CSV/JSONL and corrupt history blocking')
