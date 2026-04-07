import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SortModeSelector } from '../SortModeSelector';

describe('SortModeSelector', () => {
    afterEach(cleanup);
    it('renders a button with aria-label "Sort mode"', () => {
        render(<SortModeSelector value="none" onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Sort mode' })).toBeInTheDocument();
    });

    it('opens menu with 8 sort options on click', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<SortModeSelector value="none" onChange={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Sort mode' }));

        const menu = screen.getByRole('menu');
        const items = within(menu).getAllByRole('menuitem');
        expect(items).toHaveLength(8);

        const expectedLabels = ['None', 'Name', 'Type', 'Last Opened', 'Created', 'Modified', 'Size', 'Tag'];
        for (const label of expectedLabels) {
            expect(within(menu).getByLabelText(label)).toBeInTheDocument();
        }

        unmount();
    });

    it('calls onChange with the selected sort mode', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        const { unmount } = render(<SortModeSelector value="none" onChange={onChange} />);

        await user.click(screen.getByRole('button', { name: 'Sort mode' }));
        await user.click(within(screen.getByRole('menu')).getByLabelText('Name'));

        expect(onChange).toHaveBeenCalledWith('name');
        unmount();
    });

    it('has aria-label on each menu item', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<SortModeSelector value="none" onChange={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Sort mode' }));

        const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
        for (const item of items) {
            expect(item).toHaveAttribute('aria-label');
        }
        unmount();
    });
});
