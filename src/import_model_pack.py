"""Import the user-selected Eagle pack without modifying the originals."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EAGLE = Path('/Users/bytedance/Documents/Haodman_Eagle/Haodman.library/images')
ROWS = '''MTAR8LOKKWTH0|蓝帽耳机自拍|自拍,半身,室内
MT9VRDISD4R8B|楼梯咖啡|全身,室内
MT969T7D7H1ZA|窗边咖啡|全身,室内
MT9VRDIQC9PCI|海边粉衣双人|双人,全身,户外
MT969T7DTE8KE|秋日长椅|全身,户外
MT9VRDIQR4J7H|海边撑伞|全身,户外
MT9VRDIQFS0I6|海边与小狗|全身,户外
MT969T7D9RU8O|绿衣街边咖啡|全身,户外
MTAR8LOK97U2P|机场行李箱|全身,室内
MTAR8LOJVBSYS|灰卫衣镜拍|自拍,半身,室内
MT9VRDIRX3WZ1|公园蓝毛衣|全身,户外
MT969T7DQ9C5O|秋日长大衣|全身,户外
MT969T7EH19DI|墨镜近景自拍|自拍,半身,户外
MTAR8LOH90GDX|蓝帽卫衣自拍|自拍,半身,室内
MTAR8LOIGHPFB|黑衬衫镜拍|自拍,半身,室内
MTAR8LOJXJ2YR|红沙发电脑|全身,室内
MT969T7EO48BZ|机舱镜拍|自拍,半身,室内
MT9VRDITUN4JC|街边汉堡|半身,户外,夜景
MT9VRDIREH5GG|夜晚车窗|半身,室内,夜景
MT969T7FHQT5M|耳机镜拍|自拍,半身,室内
MT9VRDIQ0USII|雨靴与小狗|户外
MTAR8LOJWMAF8|街头买咖啡|半身,户外
MT969T7FM64E2|城市墨镜自拍|自拍,半身,户外
MT969T7E28K2H|红头巾街拍|全身,户外
MT969T7FR64W7|红背心街拍|全身,户外
MT969T7EW5K8M|黑衣街边|半身,户外
MT969T7F6KI97|街边俯拍|全身,户外
MT969T7G98FZX|地铁条纹衫|半身,室内
MT969T7EZD5NI|斑马线街拍|全身,户外
MT969T7DYUH9E|车内绿毛衣|全身,室内
MT969T7CWWK0U|黄帽镜拍|自拍,半身,室内
MT969T7DSJH6X|粉衣咖啡侧坐|全身,户外
MT969T7C82GS4|粉衣咖啡正坐|全身,户外
MT9ON1MGYKV3D|白帽横版自拍|自拍,半身,户外'''

def main():
    dest = ROOT / 'models' / 'eagle-pack'
    dest.mkdir(exist_ok=True)
    records = []
    for row in ROWS.splitlines():
        key, name, tags = row.split('|')
        files = [p for p in (EAGLE / (key + '.info')).iterdir()
                 if p.suffix.lower() in ('.jpg', '.png') and '_thumbnail' not in p.name]
        assert len(files) == 1, (key, files)
        original = files[0]
        target = dest / (key + '.jpg')
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82',
                        '-Z', '1400', str(original), '--out', str(target)], check=True, capture_output=True)
        thumb = dest / (key + '-thumb.jpg')
        subprocess.run(['sips', '-Z', '280', str(target), '--out', str(thumb)], check=True, capture_output=True)
        dims = subprocess.check_output(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(target)], text=True)
        sizes = [int(line.split(':')[1]) for line in dims.splitlines() if 'pixelWidth:' in line or 'pixelHeight:' in line]
        records.append({'name': name, 'tags': ['横图' if sizes[0] >= sizes[1] else '竖图'] + tags.split(','),
                        'src': 'src/models/eagle-pack/' + target.name, 'thumb': 'src/models/eagle-pack/' + thumb.name})
    (dest / 'manifest.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    print('Imported', len(records), 'images')

if __name__ == '__main__':
    main()
