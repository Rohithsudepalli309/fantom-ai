export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem('auth_token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        window.dispatchEvent(new Event('auth:unauthorized'));
    }

    return response;
}
