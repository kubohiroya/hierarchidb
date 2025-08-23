/**
 * @file csvParser.test.ts
 * @description Tests for CSV parsing functionality
 */

// Simple CSV parser for testing
const parseCSVContent = (content: string, delimiter: string = ','): {
  columns: string[];
  rows: Array<Array<string | number>>;
} => {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }

  // Parse header
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  // Parse rows
  const rows: Array<Array<string | number>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => {
      // Remove quotes
      const cleaned = v.trim().replace(/^["']|["']$/g, '');
      // Try to parse as number
      const num = parseFloat(cleaned);
      return isNaN(num) ? cleaned : num;
    });
    
    if (values.length === headers.length) {
      rows.push(values);
    }
  }

  return { columns: headers, rows };
};

describe('CSV Parser', () => {
  it('should parse basic CSV content', () => {
    const csvContent = `name,age,city
John,30,Tokyo
Jane,25,Osaka
Bob,35,Kyoto`;

    const result = parseCSVContent(csvContent);

    expect(result.columns).toEqual(['name', 'age', 'city']);
    expect(result.rows).toEqual([
      ['John', 30, 'Tokyo'],
      ['Jane', 25, 'Osaka'],
      ['Bob', 35, 'Kyoto']
    ]);
  });

  it('should parse TSV content', () => {
    const tsvContent = `name\tage\tcity
John\t30\tTokyo
Jane\t25\tOsaka`;

    const result = parseCSVContent(tsvContent, '\t');

    expect(result.columns).toEqual(['name', 'age', 'city']);
    expect(result.rows).toEqual([
      ['John', 30, 'Tokyo'],
      ['Jane', 25, 'Osaka']
    ]);
  });

  it('should handle quoted values', () => {
    const csvContent = `"name","age","description"
"John Doe",30,"A person from Tokyo"
"Jane Smith",25,"Lives in Osaka"`;

    const result = parseCSVContent(csvContent);

    expect(result.columns).toEqual(['name', 'age', 'description']);
    expect(result.rows).toEqual([
      ['John Doe', 30, 'A person from Tokyo'],
      ['Jane Smith', 25, 'Lives in Osaka']
    ]);
  });

  it('should handle empty content', () => {
    const result = parseCSVContent('');
    expect(result.columns).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('should handle content with only headers', () => {
    const result = parseCSVContent('name,age,city');
    expect(result.columns).toEqual(['name', 'age', 'city']);
    expect(result.rows).toEqual([]);
  });
});