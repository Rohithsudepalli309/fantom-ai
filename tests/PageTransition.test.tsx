import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PageTransition from '../src/components/PageTransition';
import React from 'react';

describe('PageTransition', () => {
    it('renders children correctly', () => {
        render(
            <PageTransition>
                <div data-testid="child">Child Content</div>
            </PageTransition>
        );

        expect(screen.getByTestId('child')).toBeInTheDocument();
        expect(screen.getByText('Child Content')).toBeInTheDocument();
    });
});
