// โยน HttpError ใน controller ได้เลย errorHandler จะแปลงเป็น JSON { error, details } ให้
// (Express 5 จับ error ของ async function ให้เอง ไม่ต้องครอบ try/catch)

export class HttpError extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
