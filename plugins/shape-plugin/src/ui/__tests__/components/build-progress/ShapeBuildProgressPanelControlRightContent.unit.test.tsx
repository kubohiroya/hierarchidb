import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { ShapeBuildProgressPanelControlRightContent } from '../../../components/build-progress/ShapeBuildProgressPanel/useShapeBuildProgressPanelController/useShapeBuildProgressPanelControllerOverlay/ShapeBuildProgressPanelControllerOverlayDialogsView';

describe('ShapeBuildProgressPanelControlRightContent', () => {
  it('accepts typing in task search input', () => {
    const Harness = () => {
      const [value, setValue] = useState('');
      return ShapeBuildProgressPanelControlRightContent({
        taskSearchText: value,
        setTaskSearchText: setValue,
        t: (_key, fallback) => fallback ?? '',
        toLabel: (text) => text ?? '',
      });
    };

    render(<Harness />);

    const searchInput = screen.getByPlaceholderText('Search tasks') as HTMLInputElement;
    fireEvent.mouseDown(searchInput);
    fireEvent.click(searchInput);
    fireEvent.change(searchInput, { target: { value: 'transform' } });

    expect(searchInput.value).toBe('transform');
  });
});
