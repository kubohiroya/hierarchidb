import { describe, expect, it } from 'vitest';

import { FlagOverlay } from '../FlagOverlay';

describe('FlagOverlay', () => {
  it('renders one span per item and keeps overlay order by array index', () => {
    const element = FlagOverlay({
      width: 160,
      height: 120,
      items: [
        { isoCode: 'JP', x: 10, y: 20 },
        { isoCode: 'US', x: 12, y: 24 },
      ],
    });

    const children = Array.isArray(element.props.children)
      ? element.props.children
      : [element.props.children];

    expect(children).toHaveLength(2);
    expect(children[0].props.style.zIndex).toBe(0);
    expect(children[1].props.style.zIndex).toBe(1);
    expect(children[0].props.style.left).toBe('10px');
    expect(children[0].props.style.top).toBe('20px');
  });

  it('uses fallback symbol for invalid ISO code', () => {
    const element = FlagOverlay({
      width: 120,
      height: 80,
      fallbackSymbol: '*',
      items: [{ isoCode: 'ZZZ', x: 5, y: 6 }],
    });

    const child = Array.isArray(element.props.children)
      ? element.props.children[0]
      : element.props.children;

    expect(child.props.children).toBe('*');
  });
});
