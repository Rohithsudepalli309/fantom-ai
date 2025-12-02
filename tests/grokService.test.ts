import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateGrokImage, isGrokConfigured, getGrokBaseUrl } from '../src/services/grokService';

// Mock global fetch
global.fetch = vi.fn();

describe('grokService', () => {
    let getItemSpy: any;

    beforeEach(() => {
        vi.resetAllMocks();
        // Spy on existing localStorage.getItem
        getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

        // Try stubbing env
        vi.stubEnv('VITE_XAI_BASE_URL', 'https://api.x.ai');
        vi.stubEnv('VITE_XAI_API_KEY', 'fake-key');
    });

    afterEach(() => {
        getItemSpy.mockRestore();
        vi.unstubAllEnvs();
    });

    it('should check configuration correctly', () => {
        getItemSpy.mockReturnValue('test-key');
        expect(isGrokConfigured()).toBe(true);
    });

    it('should handle successful image generation', async () => {
        console.log('Window defined?', typeof window !== 'undefined');
        console.log('Base URL:', getGrokBaseUrl());

        const mockResponse = {
            data: [{
                url: 'https://example.com/image.png',
                revised_prompt: 'revised prompt'
            }]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        // Mock config via localStorage spy
        getItemSpy.mockImplementation((key: string) => {
            if (key === 'VITE_XAI_API_KEY') return 'fake-key';
            if (key === 'VITE_XAI_BASE_URL') return 'https://api.x.ai';
            if (key === 'VITE_XAI_IMAGE_MODEL') return 'grok-2-image-1212';
            return null;
        });

        const result = await generateGrokImage({ prompt: 'test prompt' });

        expect(result.success).toBe(true);
        expect(result.url).toBe('https://example.com/image.png');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('https://api.x.ai/v1/images/generations'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer fake-key'
                })
            })
        );
    });

    it('should handle API errors', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: false,
            status: 400,
            text: async () => 'Bad Request'
        });

        getItemSpy.mockImplementation((key: string) => {
            if (key === 'VITE_XAI_API_KEY') return 'fake-key';
            if (key === 'VITE_XAI_BASE_URL') return 'https://api.x.ai';
            return null;
        });

        const result = await generateGrokImage({ prompt: 'test prompt' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('xAI API error (400)');
    });
});
