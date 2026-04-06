import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewModeSelector } from '../ViewModeSelector';

describe('ViewModeSelector', () => {
    describe('narrow viewport (menu mode)', () => {
        it('renders an icon button with aria-label "View mode"', () => {
            render(<ViewModeSelector value="list" onChange={vi.fn()} forceWide={false} />);
            expect(screen.getByRole('button', { name: 'View mode' })).toBeInTheDocument();
        });

        it('opens menu with 3 view mode options on click', async () => {
            const user = userEvent.setup();
            const { unmount } = render(<ViewModeSelector value="list" onChange={vi.fn()} forceWide={false} />);

            await user.click(screen.getByRole('button', { name: 'View mode' }));

            const menu = screen.getByRole('menu');
            expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
            expect(within(menu).getByLabelText('Icon')).toBeInTheDocument();
            expect(within(menu).getByLabelText('List')).toBeInTheDocument();
            expect(within(menu).getByLabelText('Column')).toBeInTheDocument();
            unmount();
        });

        it('calls onChange when a menu item is clicked', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            const { unmount } = render(<ViewModeSelector value="list" onChange={onChange} forceWide={false} />);

            await user.click(screen.getByRole('button', { name: 'View mode' }));
            await user.click(within(screen.getByRole('menu')).getByLabelText('Icon'));

            expect(onChange).toHaveBeenCalledWith('icon');
            unmount();
        });
    });

    describe('wide viewport (toggle button group mode)', () => {
        it('renders a ToggleButtonGroup with aria-label "View mode"', () => {
            render(<ViewModeSelector value="list" onChange={vi.fn()} forceWide={true} />);
            expect(screen.getByRole('group', { name: 'View mode' })).toBeInTheDocument();
        });

        it('renders 3 toggle buttons with aria-labels', () => {
            render(<ViewModeSelector value="list" onChange={vi.fn()} forceWide={true} />);
            expect(screen.getByLabelText('Icon view')).toBeInTheDocument();
            expect(screen.getByLabelText('List view')).toBeInTheDocument();
            expect(screen.getByLabelText('Column view')).toBeInTheDocument();
        });

        it('calls onChange when a toggle button is clicked', async () => {
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(<ViewModeSelector value="list" onChange={onChange} forceWide={true} />);

            await user.click(screen.getByLabelText('Icon view'));

            expect(onChange).toHaveBeenCalledWith('icon');
        });
    });
});
