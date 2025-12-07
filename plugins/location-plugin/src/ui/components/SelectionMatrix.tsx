import React, { useCallback, useId } from 'react';
import { Box, Checkbox, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { LocationType } from '../../common/types/index.js';
import { useTranslation } from '../../common/i18n/index.js';

export interface Country {
  code: string;
  name: string;
  localName?: string;
  continent: string;
}

export interface LocationTypeConfig {
  id: LocationType;
  name: string;
  icon: string;
  color: string;
  description: string;
  estimatedCount?: number;
}

interface SelectionMatrixProps {
  countries: Country[];
  locationTypes: LocationTypeConfig[];
  value: boolean[][];
  onChange: (matrix: boolean[][]) => void;
  disabled?: boolean;
}

export const SelectionMatrix: React.FC<SelectionMatrixProps> = ({
  countries,
  locationTypes,
  value,
  onChange,
  disabled = false,
}) => {
  const controlId = useId();
  const { translations } = useTranslation();

  const handleToggle = useCallback((countryIndex: number, typeIndex: number) => {
    const currentMatrix = countries.map((_, rowIdx) => (
      locationTypes.map((__, colIdx) => Boolean(value[rowIdx]?.[colIdx]))
    ));
    const nextMatrix = currentMatrix.map((row, rowIdx) => (
      rowIdx === countryIndex
        ? row.map((cell, colIdx) => (colIdx === typeIndex ? !cell : cell))
        : row
    ));
    onChange(nextMatrix);
  }, [countries, locationTypes, onChange, value]);

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{translations.selectionMatrix.columnHeader}</TableCell>
            {locationTypes.map((type) => (
              <TableCell key={type.id} align="center">
                <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                  <span>{type.icon}</span>
                  <Typography variant="caption">{type.name}</Typography>
                </Box>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {countries.map((country, rowIndex) => (
            <TableRow key={country.code} hover>
              <TableCell>
                <Typography variant="body2">{country.name}</Typography>
                {country.localName && (
                  <Typography variant="caption" color="text.secondary">{country.localName}</Typography>
                )}
              </TableCell>
              {locationTypes.map((_, columnIndex) => (
                <TableCell key={columnIndex} align="center">
                  <Checkbox
                    size="small"
                    checked={Boolean(value[rowIndex]?.[columnIndex])}
                    onChange={() => handleToggle(rowIndex, columnIndex)}
                    disabled={disabled}
                    inputProps={{
                      id: `${controlId}-${country.code}-${columnIndex}`,
                      name: `${country.code}-${columnIndex}`,
                      'aria-label': `${country.name} ${locationTypes[columnIndex]?.name ?? ''}`,
                    }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
