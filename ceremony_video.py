"""
「道途」突破仪式视频生成器
复用 video-auto-pipeline 的 4 步 (image/audio/compose/merge)
专为境界突破时刻生成 30 秒短视频,可分享到 B 站/小红书

用法:
    python3 ceremony_video.py <realm_code>    # e.g. python3 ceremony_video.py foundation
    python3 ceremony_video.py --list          # 列出可生成的境界
"""

import json
import os
import sys
import urllib.parse
import subprocess
import time
from pathlib import Path

# ---- 引入 video-auto-pipeline 的 4 步函数 ----
sys.path.insert(0, '/root/ai-video-pipeline')
from pipeline import (
    step1_generate_images,
    step2_generate_audio,
    step2b_generate_subtitles,
    step3_compose_clips,
    step4_merge_video,
)

# ---- 输出目录 ----
CEREMONY_DIR = Path('/root/health-cultivation-simulator/ceremony_videos')
CEREMONY_DIR.mkdir(exist_ok=True)
TMP_IMG = Path('/tmp/ceremony_imgs')
TMP_AUDIO = Path('/tmp/ceremony_audio')
TMP_CLIPS = Path('/tmp/ceremony_clips')
TMP_SUBS = Path('/tmp/ceremony_subs')
for d in [TMP_IMG, TMP_AUDIO, TMP_CLIPS, TMP_SUBS]:
    d.mkdir(exist_ok=True)

# ---- 6 个境界视频剧本 ----
REALM_VIDEO_STORIES = {
    'foundation': {
        'title': '筑基突破·一念清明',
        'segments': [
            {
                'id': 1,
                'subtitle': '道友,此刻灵气充沛,可要筑基?',
                'narration': '道友,此刻灵气充沛,可要筑基?',
                'image_prompt': 'Chinese ink painting style, a lone daoist cultivator standing on mountain peak under starry night, ink green background #2c4a3e, gold energy aura surrounding body, vertical mobile format 9:16, mist and cloud at bottom, dramatic atmosphere, no emoji, no English text',
            },
            {
                'id': 2,
                'subtitle': '精进七七四十九日,根基将立',
                'narration': '精进七七四十九日,根基将立。',
                'image_prompt': 'Chinese ink painting style, golden energy pillars rising from ground into clouds, mountain silhouette in distance, vertical mobile format 9:16, dramatic dusk atmosphere, soft golden particles, no emoji, no English text',
            },
            {
                'id': 3,
                'subtitle': '恭喜道友,筑基已成',
                'narration': '恭喜道友,筑基已成!',
                'image_prompt': 'Chinese ink painting style, large glowing Chinese seal character with golden light beams breakthrough moment, dark ink green background, jade mountain silhouette, epic atmosphere, vertical mobile format 9:16, particles like floating lotus petals, no emoji, no English text',
            },
        ],
        'tags': ['道途', '修仙', '筑基', '突破'],
    },
    'golden_core': {
        'title': '金丹突破·神识初成',
        'segments': [
            {
                'id': 1,
                'subtitle': '百日筑基毕,金丹将凝',
                'narration': '百日筑基毕,金丹将凝。',
                'image_prompt': 'Chinese ink painting style, glowing golden pill floating above ceremonial altar, mountain temple silhouette in background, ink green background, vertical 9:16, sacred atmosphere, no emoji, no English',
            },
            {
                'id': 2,
                'subtitle': '神识一出,内观己身',
                'narration': '神识一出,内观己身。',
                'image_prompt': 'Chinese ink painting style, ethereal spirit silhouette rising from meditation figure, soft golden glow, vertical 9:16 ink green background, mystical atmosphere, no emoji, no English',
            },
            {
                'id': 3,
                'subtitle': '恭喜道友,金丹已成',
                'narration': '恭喜道友,金丹已成!',
                'image_prompt': 'Chinese ink painting breakthrough scene, bright golden light explosion center, dark ink green background, vertical 9:16 epic dramatic moment, large gold seal character, no emoji, no English text',
            },
        ],
        'tags': ['道途', '修仙', '金丹'],
    },
    'nascent_soul': {
        'title': '元婴突破·阴神出窍',
        'segments': [
            {
                'id': 1,
                'subtitle': '三百日精进,阴神可出',
                'narration': '三百日精进,阴神可出。',
                'image_prompt': 'Chinese ink painting, ethereal shadow figure emerging from body silhouette, purple mist, vertical 9:16 ink green background, mystical, no emoji, no English',
            },
            {
                'id': 2,
                'subtitle': '神游太虚,万物皆映',
                'narration': '神游太虚,万物皆映。',
                'image_prompt': 'Chinese ink painting style, small spirit figure floating above vast cosmic landscape, mountains and rivers far below, soft purple and gold, vertical 9:16, no emoji, no English',
            },
            {
                'id': 3,
                'subtitle': '恭喜道友,元婴已成',
                'narration': '恭喜道友,元婴已成!',
                'image_prompt': 'Chinese ink painting breakthrough, large purple and gold seal character, dark ink green background, vertical 9:16 epic, glowing aura, no emoji, no English',
            },
        ],
        'tags': ['道途', '元婴', '突破'],
    },
    'divine_spirit': {
        'title': '化神突破·通达神明',
        'segments': [
            {
                'id': 1,
                'subtitle': '九转丹成,神将化也',
                'narration': '九转丹成,神将化也。',
                'image_prompt': 'Chinese ink painting, glowing spirit rising like phoenix, ethereal teal light, vertical 9:16 ink green background, sacred, no emoji, no English',
            },
            {
                'id': 2,
                'subtitle': '虚室生白,通达神明',
                'narration': '虚室生白,通达神明。',
                'image_prompt': 'Chinese ink painting, vast white void with single daoist silhouette, vertical 9:16, ink green background, cosmic atmosphere, no emoji, no English',
            },
            {
                'id': 3,
                'subtitle': '恭喜道友,化神已成',
                'narration': '恭喜道友,化神已成!',
                'image_prompt': 'Chinese ink painting breakthrough, large teal and gold seal character, vertical 9:16, dark ink green background, epic dramatic moment, glowing aura, no emoji, no English',
            },
        ],
        'tags': ['道途', '化神', '突破'],
    },
    'tribulation': {
        'title': '渡劫飞升·九霄雷音',
        'segments': [
            {
                'id': 1,
                'subtitle': '千年修道,今朝天劫至',
                'narration': '千年修道,今朝天劫至。',
                'image_prompt': 'Chinese ink painting, dark thunderstorm sky with lightning strikes, mountain peak silhouette, vertical 9:16 ink green background, dramatic red-black sky, no emoji, no English',
            },
            {
                'id': 2,
                'subtitle': '吾当以道破劫',
                'narration': '吾当以道破劫!',
                'image_prompt': 'Chinese ink painting, lone daoist figure facing storm, sword raised, lightning strikes, vertical 9:16, heroic atmosphere, no emoji, no English',
            },
            {
                'id': 3,
                'subtitle': '恭喜道友,飞升仙界',
                'narration': '恭喜道友,飞升仙界!',
                'image_prompt': 'Chinese ink painting breakthrough to ascension, large red seal character, brilliant white light from above, vertical 9:16, dark ink green background, epic ultimate moment, no emoji, no English',
            },
        ],
        'tags': ['道途', '渡劫', '飞升'],
    },
}


def list_realms():
    print('\n可生成的境界视频:')
    for code, story in REALM_VIDEO_STORIES.items():
        print(f'  {code:14s} → {story["title"]}')


def make_content_json(realm_code):
    """为指定境界生成 content.json,贴合 pipeline.py 的数据格式"""
    story = REALM_VIDEO_STORIES.get(realm_code)
    if not story:
        raise ValueError(f'未知境界 {realm_code}')
    content = {
        'title': story['title'],
        'desc': f'「道途」{story["title"]} - 健康修仙模拟器突破仪式纪念',
        'tags': story['tags'] + ['健康修仙', '道途', '突破时刻'],
        'segments': story['segments'],
    }
    return content


def patch_pipeline_for_ceremony():
    """把 pipeline.py 的常量重定向到 ceremony 临时目录"""
    import pipeline
    pipeline.IMG_DIR = str(TMP_IMG)
    pipeline.AUDIO_DIR = str(TMP_AUDIO)
    pipeline.CLUPS_DIR = pipeline.CLIPS_DIR = str(TMP_CLIPS)
    pipeline.SUBS_DIR = str(TMP_SUBS)
    pipeline.OUTPUT_DIR = str(CEREMONY_DIR)


def generate_ceremony_video(realm_code):
    """主入口:为某境界生成 30 秒突破视频"""
    if realm_code == '--list' or realm_code == '-l':
        list_realms()
        return None

    story = REALM_VIDEO_STORIES.get(realm_code)
    if not story:
        print(f'❌ 未知道路 {realm_code}')
        list_realms()
        return None

    patch_pipeline_for_ceremony()

    # 写入临时的 content.json
    content = make_content_json(realm_code)
    content_path = CEREMONY_DIR / f'{realm_code}_content.json'
    with open(content_path, 'w', encoding='utf-8') as f:
        json.dump(content, f, ensure_ascii=False, indent=2)

    print(f'🥋 「道途」— 境界突破视频生成器')
    print(f'=' * 60)
    print(f'   目标: {story["title"]}')
    print(f'   段落: {len(content["segments"])} 段 (~ 30 秒)')
    print(f'   输出: {CEREMONY_DIR}/')
    print(f'=' * 60)

    # 强制覆盖 pipeline 的输出文件名
    pipeline = sys.modules['pipeline']

    t0 = time.time()
    pipeline.step1_generate_images(content['segments'])
    pipeline.step2_generate_audio(content['segments'])
    pipeline.step2b_generate_subtitles(content['segments'])
    pipeline.step3_compose_clips(content['segments'])
    final = pipeline.step4_merge_video(content['segments'])

    elapsed = time.time() - t0

    # 重命名最终文件
    if final and os.path.exists(final):
        target = CEREMONY_DIR / f'{realm_code}_breakthrough.mp4'
        if final != target:
            os.rename(final, target)
            final = target

        size_mb = os.path.getsize(final) / 1024 / 1024
        print(f'\n🎉 完成! 耗时 {elapsed:.0f}s, 文件 {size_mb:.1f} MB')
        print(f'   📹 {final}')
        return str(final)
    else:
        print(f'\n❌ 生成失败')
        return None


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('用法: python3 ceremony_video.py <realm_code>')
        print('可用: refining | foundation | golden_core | nascent_soul | divine_spirit | tribulation')
        print('     --list      列出所有境界')
        sys.exit(1)

    realm = sys.argv[1]
    result = generate_ceremony_video(realm)
    if result:
        sys.exit(0)
    sys.exit(1)
