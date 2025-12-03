export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem('auth_token');
    console.log(`[API] Fetching ${url} with token: ${token ? 'Present' : 'MISSING'}`);

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
        console.error(`[API] 401 Unauthorized for ${url}. Dispatching auth:unauthorized.`);
        window.dispatchEvent(new Event('auth:unauthorized'));
    }

    return response;
}
