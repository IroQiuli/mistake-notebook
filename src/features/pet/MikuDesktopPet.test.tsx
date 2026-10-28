import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MikuDesktopPet } from './MikuDesktopPet';
import { db, setSetting } from '../../storage/db';

beforeEach(async () => {
  localStorage.clear();
  await db.settings.clear();
  await setSetting('theme', 'miku');
  await setSetting('petEnabled', true);
  await setSetting('petSize', 64);
});

describe('MikuDesktopPet 组件测试', () => {
  it('在初音主题且开启桌宠时正常渲染，并包含无障碍标签', () => {
    render(
      <MemoryRouter>
        <MikuDesktopPet />
      </MemoryRouter>
    );

    const pet = screen.getByLabelText('初音未来伴学桌宠');
    expect(pet).toBeInTheDocument();
  });

  it('点击戳一戳触发伴学对话气泡', () => {
    render(
      <MemoryRouter>
        <MikuDesktopPet />
      </MemoryRouter>
    );

    const pet = screen.getByLabelText('初音未来伴学桌宠');
    // 触发 pointerDown 和 pointerUp 模拟轻点
    fireEvent.pointerDown(pet, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(pet, { clientX: 50, clientY: 50, pointerId: 1 });

    // 气泡中应出现 Miku 伴学时刻标题与打气文字
    expect(screen.getByText('Miku 伴学时刻')).toBeInTheDocument();
  });

  it('当主题切换为默认主题时，桌宠静默隐藏不渲染', async () => {
    await setSetting('theme', 'default');
    const { container } = render(
      <MemoryRouter>
        <MikuDesktopPet />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('默认采用动态小人模式 (Shimeji) 渲染动态图像', () => {
    render(
      <MemoryRouter>
        <MikuDesktopPet />
      </MemoryRouter>
    );

    const img = screen.getByAltText('初音未来动态桌宠');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain('themes/miku/shimeji');
  });

  it('切换为高清立绘模式时渲染矢量立绘', async () => {
    await setSetting('petStyle', 'chibi');
    render(
      <MemoryRouter>
        <MikuDesktopPet />
      </MemoryRouter>
    );

    const pet = screen.getByLabelText('初音未来伴学桌宠');
    expect(pet).toBeInTheDocument();
    expect(screen.queryByAltText('初音未来动态桌宠')).toBeNull();
  });

  it('拖拽移动时切换为扑腾悬空状态', () => {
    render(
      <MemoryRouter>
        <MikuDesktopPet />
      </MemoryRouter>
    );

    const pet = screen.getByLabelText('初音未来伴学桌宠');
    fireEvent.pointerDown(pet, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pet, { clientX: 130, clientY: 140, pointerId: 1 });

    const img = screen.getByAltText('初音未来动态桌宠');
    expect(img).toBeInTheDocument();
    // 拖拽悬空扑腾帧
    expect(img.getAttribute('src')).toMatch(/shime5|shime6|shime7|shime8/);
  });

  it('拖拽向左或向右移动时随动摇摆，静止时垂立悬挂', () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <MikuDesktopPet />
      </MemoryRouter>
    );

    const pet = screen.getByLabelText('初音未来伴学桌宠');
    act(() => {
      fireEvent.pointerDown(pet, { clientX: 100, clientY: 100, pointerId: 1 });
      // 向右拖拽：向右移动，身体向左后甩起 (shime7)
      fireEvent.pointerMove(pet, { clientX: 160, clientY: 100, pointerId: 1 });
    });
    let img = screen.getByAltText('初音未来动态桌宠');
    expect(img.getAttribute('src')).toContain('shime7.png');

    act(() => {
      // 向左拖拽：向左移动，身体向右后甩起 (shime8)
      fireEvent.pointerMove(pet, { clientX: 90, clientY: 100, pointerId: 1 });
    });
    img = screen.getByAltText('初音未来动态桌宠');
    expect(img.getAttribute('src')).toContain('shime8.png');

    // 静止不动 120ms 后：判定为在空中静止悬挂 (shime6)
    act(() => {
      vi.advanceTimersByTime(150);
    });
    img = screen.getByAltText('初音未来动态桌宠');
    expect(img.getAttribute('src')).toContain('shime6.png');

    vi.useRealTimers();
  });
});
