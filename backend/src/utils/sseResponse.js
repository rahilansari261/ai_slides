/**
 * SSE Response utilities matching FastAPI sse_response.py
 */

/**
 * Base SSE Response
 */
export class SSEResponse {
  constructor(event, data) {
    this.event = event;
    this.data = data;
  }

  toString() {
    return `event: ${this.event}\ndata: ${this.data}\n\n`;
  }
}

/**
 * SSE Status Response
 */
export class SSEStatusResponse {
  constructor(status) {
    this.status = status;
  }

  toString() {
    return new SSEResponse(
      'response',
      JSON.stringify({ type: 'status', status: this.status })
    ).toString();
  }
}

/**
 * SSE Error Response
 */
export class SSEErrorResponse {
  constructor(detail) {
    this.detail = detail;
  }

  toString() {
    return new SSEResponse(
      'response',
      JSON.stringify({ type: 'error', detail: this.detail })
    ).toString();
  }
}

/**
 * SSE Complete Response
 */
export class SSECompleteResponse {
  constructor(key, value) {
    this.key = key;
    this.value = value;
  }

  toString() {
    // Match FastAPI format: { "type": "complete", key: value }
    const data = { type: 'complete' };
    data[this.key] = this.value;
    return new SSEResponse(
      'response',
      JSON.stringify(data)
    ).toString();
  }
}

