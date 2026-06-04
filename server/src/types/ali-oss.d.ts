declare module 'ali-oss' {
  interface OSSOptions {
    region: string;
    endpoint?: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    secure?: boolean;
  }

  interface OSSResponse {
    headers?: Record<string, string | string[] | undefined>;
  }

  interface OSSHeadResult {
    res: OSSResponse;
    status: number;
    meta: Record<string, string | undefined> | null;
  }

  interface OSSMetaResult {
    res: OSSResponse;
    status: number;
  }

  class OSS {
    constructor(options: OSSOptions);
    signatureUrl(
      name: string,
      options?: Record<string, string | number | boolean | undefined>,
      strictObjectNameValidation?: boolean,
    ): string;
    head(name: string, options?: Record<string, unknown>): Promise<OSSHeadResult>;
    getObjectMeta(name: string, options?: Record<string, unknown>): Promise<OSSMetaResult>;
  }

  export = OSS;
}
