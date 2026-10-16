export interface MessageResponse {
  code?: number;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total_pages: number;
  total_items: number;
}

export interface DataResponse<T> {
  code: number;
  data: T;
  pagination?: PaginationMeta;
}

export interface ApiErrorResponse {
  detail?: string | Array<{ loc: (string | number)[]; msg: string; type: string }>;
  message?: string;
}

export class ApiError extends Error {
  status: number;
  data?: ApiErrorResponse;

  constructor(status: number, message: string, data?: ApiErrorResponse) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}
