# 把 app.html + app.js + models/*.jpg 打包成单文件 music-fx-lab.html
# 用法：在 src/ 目录里执行  python3 build.py
import base64, glob, json, os

meta = [("车内自拍",["自拍","室内"]),("橙色长裙",["全身","户外"]),("蓝天大笑",["自拍","户外"]),("天台夕阳",["半身","户外"]),
        ("红格衬衫",["自拍","户外"]),("街头双人",["双人","全身","夜景"]),("砖墙双人",["双人","半身","室内"]),("唱片墙",["自拍","室内","夜景"]),
        ("镜子自拍",["半身","室内"]),("奶昔咖啡厅",["半身","室内"]),("超市耳机",["自拍","室内"]),("走廊全身",["全身","室内"]),
        ("海边白T",["半身","户外"]),("鱼眼电话亭",["自拍","户外"]),("沙发午后",["全身","户外"]),("红卫衣镜拍",["半身","室内"]),
        ("地毯俯拍",["半身","室内"]),("健身房",["自拍","室内"]),("条纹衫眼镜",["自拍","户外"]),("卷发白裙",["半身","室内"])]

horizontal_meta = {
    'h18.jpg': ("多人18", ["横图", "双人", "半身", "户外"]),
    'h20.jpg': ("多人20", ["横图", "双人", "半身", "室内"]),
    'h31.jpg': ("多人31", ["横图", "多人", "自拍", "半身", "夜景"]),
    'h33.jpg': ("多人33", ["横图", "多人", "半身", "室内"]),
}

here = os.path.dirname(os.path.abspath(__file__))
os.chdir(here)
fs = sorted(glob.glob('models/m*.jpg'))
presets = [{
    "name": meta[i][0], "tags": meta[i][1] + ["竖图"],
    "src": "data:image/jpeg;base64," + base64.b64encode(open(f, 'rb').read()).decode()
} for i, f in enumerate(fs)]
for f in sorted(glob.glob('models/h*.jpg')):
    name, tags = horizontal_meta[os.path.basename(f)]
    presets.append({"name": name, "tags": tags,
                    "src": "data:image/jpeg;base64," + base64.b64encode(open(f, 'rb').read()).decode()})
pack_manifest = os.path.join(here, 'models', 'eagle-pack', 'manifest.json')
if os.path.exists(pack_manifest):
    with open(pack_manifest, encoding='utf-8') as fh:
        new_presets = json.load(fh)
        new_presets.sort(key=lambda item: 0 if item['name'] == '绿衣街边咖啡' else 1 if item['name'] == '粉衣咖啡正坐' else 2)
        presets = new_presets + presets
mdp_manifest=os.path.join(here,'models','mdp-pack','manifest.json')
if os.path.exists(mdp_manifest):
    with open(mdp_manifest,encoding='utf-8') as fh: presets=json.load(fh)+presets
arr = json.dumps(presets, ensure_ascii=False)

# Optional real-audio test pack. Keep metadata in music/library.json; the build
# embeds audio, generated covers and LRC text so the final HTML still works when
# opened directly from disk. Adding a track only requires one manifest entry.
music_library = []
music_manifest = os.path.join(here, 'music', 'library.json')
if os.path.exists(music_manifest):
    with open(music_manifest, encoding='utf-8') as fh:
        for rec in json.load(fh):
            item = dict(rec)
            # Audio is intentionally lazy-loaded. Embedding tracks made the first
            # HTML response ~30 MB and delayed every visit even before playback.
            embed = item.pop('embed', False)
            audio_path = os.path.join(here, 'music', item.pop('audio'))
            cover_path = os.path.join(here, 'music', item.pop('cover'))
            lyric_path = os.path.join(here, 'music', item.pop('lyrics'))
            ext = os.path.splitext(audio_path)[1].lower().lstrip('.')
            mime = {'mp3': 'audio/mpeg', 'm4a': 'audio/mp4', 'wav': 'audio/wav', 'ogg': 'audio/ogg'}.get(ext, 'audio/mpeg')
            item['url'] = ('data:' + mime + ';base64,' + base64.b64encode(open(audio_path, 'rb').read()).decode()) if embed else ('src/music/' + os.path.relpath(audio_path, os.path.join(here, 'music')).replace(os.sep, '/'))
            item['cover'] = 'data:image/jpeg;base64,' + base64.b64encode(open(cover_path, 'rb').read()).decode()
            item['lrc'] = open(lyric_path, encoding='utf-8').read()
            item['kind'] = 'pack'
            item['bpm'] = 0
            music_library.append(item)
music_arr = json.dumps(music_library, ensure_ascii=False)

html = open('app.html', encoding='utf-8').read()
rhythm_puzzle_js = open('rhythm-puzzle.js', encoding='utf-8').read()
punch_js = '\n'.join(open(name, encoding='utf-8').read() for name in ['punch-shapes.js','punch-studio.js','punch-scene.js','punch-presets.js','punch-effect.js'])
punch_js=punch_js.replace('/*__PUNCH_EXAMPLES__*/[]',open('models/mdp-pack/examples.json',encoding='utf-8').read())
js = open('app.js', encoding='utf-8').read()
js = js.replace('/*__PACK_TRACKS__*/[]', music_arr)
script_tags = '\n'.join('<script src="' + name + '"></script>' for name in ['rhythm-puzzle.js','punch-shapes.js','punch-studio.js','punch-scene.js','punch-presets.js','punch-effect.js','app.js'])
assert script_tags in html, 'Source script tags changed; update build order.'
html = html.replace('/*__PRESETS__*/[]', arr).replace(script_tags, '<script>\n' + rhythm_puzzle_js + '\n' + punch_js + '\n' + js + '\n</script>')
out = os.path.join(os.path.dirname(here), 'music-fx-lab.html')
open(out, 'w', encoding='utf-8').write(html)
open(os.path.join(os.path.dirname(here), 'index.html'), 'w', encoding='utf-8').write(html)
print('built', out, round(len(html) / 1e6, 2), 'MB')
