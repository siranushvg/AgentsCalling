import { describe, it, expect, vi } from 'vitest';
import { exportToCSV } from '@/lib/exportCSV';

describe('exportCSV', () => {
  it('creates a downloadable CSV from data', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const link = { click: vi.fn(), href: '', download: '' } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(link);
    vi.spyOn(document.body, 'appendChild').mockReturnValue(link);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(link);

    const data = [
      { name: 'Alice', score: 90 },
      { name: 'Bob', score: 80 },
    ];

    exportToCSV(data, 'test-export');

    expect(createObjectURL).toHaveBeenCalled();
    expect(link.click).toHaveBeenCalled();
  });
});
