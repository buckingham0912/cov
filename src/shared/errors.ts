export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class UserInputError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}