import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'tools/pixel-editor/index.html'), 'utf8');

describe('pixel editor guide', () => {
  it('names both paths and the four controls a first-time user asked about', () => {
    expect(page).toContain('使用说明');
    expect(page).toContain('路径 A');
    expect(page).toContain('路径 B');
    expect(page).toContain('载入示例');
    expect(page).toContain('不是游戏正式资产');
    expect(page).toContain('载入装配示例');
    expect(page).toContain('移入装配');
    expect(page).toContain('网格文件');
    expect(page).toContain('装配文件');
    expect(page).toContain('零件预览');
    expect(page).toContain('装配预览');
    expect(page).toContain('id="view"');
    expect(page).toContain('id="asm-view"');
    expect(page).toContain('缩放');
    expect(page).toContain('上移');
    expect(page).toContain('folded');
    expect(page).toContain('half');
    expect(page).toContain('open');
    expect(page).toContain('*.grid.json');
    expect(page).toContain('*.entity.json');
    expect(page).toContain('现役');
    expect(page).toContain('id="guide"');
    expect(page).toContain('id="guide-open"');
  });
});
