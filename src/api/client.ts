/**
 * EvalDesk Typed API Client
 * Server is the sole source of truth. Throws ApiError on any non-2xx response.
 * Never swallows or silences errors.
 */

export interface ApiErrorPayload {
  code: string;
  message: string;
  retry_at?: string | null;
  status: number;
}

export class ApiError extends Error {
  code: string;
  retry_at?: string | null;
  status: number;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.code = payload.code;
    this.retry_at = payload.retry_at;
    this.status = payload.status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) {
      return {} as T;
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  }

  let code = `HTTP_${res.status}`;
  let message = res.statusText || 'An unexpected server error occurred.';
  let retry_at: string | null = null;

  try {
    const errorJson = await res.json();
    if (errorJson) {
      if (typeof errorJson.message === 'string' && errorJson.message.trim()) {
        message = errorJson.message;
      } else if (typeof errorJson.detail === 'string' && errorJson.detail.trim()) {
        message = errorJson.detail;
      } else if (Array.isArray(errorJson.detail)) {
        message = errorJson.detail
          .map((e: any) => (typeof e === 'object' && e.msg ? `${e.loc ? e.loc.join('.') : 'field'}: ${e.msg}` : String(e)))
          .join(', ');
      } else if (errorJson.error && typeof errorJson.error.message === 'string') {
        message = errorJson.error.message;
      } else if (typeof errorJson.detail === 'object') {
        message = JSON.stringify(errorJson.detail);
      }
      if (typeof errorJson.code === 'string') {
        code = errorJson.code;
      }
      if (errorJson.retry_at) {
        retry_at = String(errorJson.retry_at);
      }
    }
  } catch {
    // If not JSON, use default status text
  }

  throw new ApiError({
    code,
    message,
    retry_at,
    status: res.status,
  });
}

export const apiClient = {
  async get<T>(url: string, headers: HeadersInit = {}): Promise<T> {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
    });
    return handleResponse<T>(res);
  },

  async post<T>(url: string, body?: unknown, headers: HeadersInit = {}): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const reqHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(headers as Record<string, string>),
    };

    if (!isFormData && body !== undefined) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: reqHeaders,
      body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async put<T>(url: string, body?: unknown, headers: HeadersInit = {}): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const reqHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(headers as Record<string, string>),
    };

    if (!isFormData && body !== undefined) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method: 'PUT',
      headers: reqHeaders,
      body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async delete<T>(url: string, headers: HeadersInit = {}): Promise<T> {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
    });
    return handleResponse<T>(res);
  },

  uploadWithProgress<T>(
    url: string,
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Accept', 'application/json');

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const parsed = JSON.parse(xhr.responseText);
            resolve(parsed);
          } catch {
            resolve(xhr.responseText as unknown as T);
          }
        } else {
          let code = `HTTP_${xhr.status}`;
          let message = xhr.statusText || 'Upload failed.';
          try {
            const errorJson = JSON.parse(xhr.responseText);
            if (errorJson.detail) {
              message = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
            } else if (errorJson.message) {
              message = errorJson.message;
            }
            if (errorJson.code) code = errorJson.code;
          } catch {
            // Non-JSON response
          }
          reject(new ApiError({ code, message, status: xhr.status }));
        }
      };

      xhr.onerror = () => {
        reject(new ApiError({ code: 'NETWORK_ERROR', message: 'Network error during upload.', status: 0 }));
      };

      xhr.send(formData);
    });
  },
};
