/* eslint-disable @typescript-eslint/no-empty-function */
import { createRabbitMQService, ensureRabbitMqVhost } from './rabbitmq';

jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('rabbitmq helpers and factory', () => {
  test('ensureRabbitMqVhost resolves on 2xx responses', async () => {
    // Arrange: mock http.request to simulate 200 for both calls
    const http = require('http');
    const orig = http.request;
    http.request = (_options: any, cb: any) => {
      const res = { statusCode: 201 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    // Act / Assert
    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).resolves.toBeUndefined();

    // restore
    http.request = orig;
  });

  test('createRabbitMQService connects and returns channel', async () => {
    // Provide createService that returns different objects depending on name
    const createServiceMulti = jest.fn().mockImplementation((name: string) => {
      if (name.startsWith('rabbitmq-management'))
        return Promise.resolve({ host: '127.0.0.1', port: 15672 });
      return Promise.resolve({ host: '127.0.0.1', port: 5672 });
    });

    // mock http.request as in previous test
    const http = require('http');
    const orig = http.request;
    http.request = (_options: any, cb: any) => {
      const res = { statusCode: 201 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    const res = await createRabbitMQService({
      id: 'r1',
      createService: createServiceMulti,
      env: { RABBITMQ_USERNAME: 'u', RABBITMQ_PASSWORD: 'p' } as any,
    });

    expect(res).toHaveProperty('channel');

    http.request = orig;
  });

  test('ensureRabbitMqVhost rejects on non-2xx responses', async () => {
    const http = require('http');
    const orig = http.request;
    http.request = (_options: any, cb: any) => {
      const res = { statusCode: 500 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow(/Failed to create vhost/);

    http.request = orig;
  });

  test('ensureRabbitMqVhost rejects when permissions call fails', async () => {
    const http = require('http');
    const orig = http.request;
    let call = 0;
    http.request = (_options: any, cb: any) => {
      call += 1;
      if (call === 1) {
        const res = { statusCode: 201 };
        setImmediate(() => cb(res));
        return { on: () => {}, end: () => {} };
      }
      const res = { statusCode: 500 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow(/Failed to set permissions/);

    http.request = orig;
  });

  test('ensureRabbitMqVhost rejects when create vhost returns <200 (e.g., 100)', async () => {
    const http = require('http');
    const orig = http.request;
    http.request = (_options: any, cb: any) => {
      const res = { statusCode: 100 };
      setImmediate(() => cb(res));
      return { on: () => {}, end: () => {} };
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow(/Failed to create vhost/);

    http.request = orig;
  });

  test('ensureRabbitMqVhost rejects when permissions call returns <200 (e.g., 100)', async () => {
    const http = require('http');
    const orig = http.request;
    let call = 0;
    http.request = (_options: any, cb: any) => {
      call += 1;
      if (call === 1) {
        const res = { statusCode: 201 };
        setImmediate(() => cb(res));
        return { on: () => {}, end: () => {} };
      }
      const res = { statusCode: 100 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow(/Failed to set permissions/);

    http.request = orig;
  });

  test('ensureRabbitMqVhost rejects when request emits error on vhost creation', async () => {
    const http = require('http');
    const orig = http.request;
    http.request = (_options: any, _cb: any) => {
      let errorHandler: any;
      const req = {
        on: (ev: string, handler: any) => {
          if (ev === 'error') errorHandler = handler;
        },
        end: () => {},
      } as any;
      // simulate async error
      setImmediate(() => {
        if (errorHandler) errorHandler(new Error('net-fail'));
      });
      return req;
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow(/net-fail/);

    http.request = orig;
  });

  test('ensureRabbitMqVhost rejects when request emits error on permissions call', async () => {
    const http = require('http');
    const orig = http.request;
    let call = 0;
    http.request = (_options: any, cb: any) => {
      call += 1;
      if (call === 1) {
        // first call succeeds
        const res = { statusCode: 201 };
        setImmediate(() => cb(res));
        return { on: () => {}, end: () => {} } as any;
      }
      let errorHandler: any;
      const req = {
        on: (ev: string, handler: any) => {
          if (ev === 'error') errorHandler = handler;
        },
        write: () => {},
        end: () => {},
      } as any;
      setImmediate(() => {
        if (errorHandler) errorHandler(new Error('perm-net-fail'));
      });
      return req;
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow(/perm-net-fail/);

    http.request = orig;
  });

  test('createRabbitMQService throws when amqp.connect fails', async () => {
    const amqp = require('amqplib');
    amqp.connect.mockRejectedValueOnce(new Error('amqp-fail')
    );

    const createServiceMulti = jest.fn().mockImplementation((name: string) => {
      if (name.startsWith('rabbitmq-management'))
        return Promise.resolve({ host: '127.0.0.1', port: 15672 });
      return Promise.resolve({ host: '127.0.0.1', port: 5672 });
    });

    // mock http.request success for vhost
    const http = require('http');
    const orig = http.request;
    http.request = (_options: any, cb: any) => {
      const res = { statusCode: 201 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    await expect(
      createRabbitMQService({
        id: 'rx',
        createService: createServiceMulti,
        env: { RABBITMQ_USERNAME: 'u', RABBITMQ_PASSWORD: 'p' } as any,
      })
    ).rejects.toThrow(/Failed to connect to RabbitMQ/);

    http.request = orig;
  });

  test('works when env not provided (uses process.env)', async () => {
    const createServiceMulti = jest.fn().mockImplementation((name: string) => {
      if (name.startsWith('rabbitmq-management'))
        return Promise.resolve({ host: '127.0.0.1', port: 15672 });
      return Promise.resolve({ host: '127.0.0.1', port: 5672 });
    });

    // mock http.request success for both calls
    const http = require('http');
    const orig = http.request;
    http.request = (_options: any, cb: any) => {
      const res = { statusCode: 201 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    // mock amqplib connect success
    const amqp = require('amqplib');
    amqp.connect.mockResolvedValueOnce({
        createChannel: jest
          .fn()
          .mockResolvedValue({ close: jest.fn().mockResolvedValue(undefined) }),
        close: jest.fn().mockResolvedValue(undefined),
      }
    );

    const res = await createRabbitMQService({
      id: 'r2',
      createService: createServiceMulti,
    } as any);
    expect(res).toHaveProperty('channel');

    http.request = orig;
  });

  test('createRabbitMQService exposes cleanup that closes channel/connection', async () => {
    const createServiceMulti = jest.fn().mockImplementation((name: string) => {
      if (name.startsWith('rabbitmq-management'))
        return Promise.resolve({ host: '127.0.0.1', port: 15672 });
      return Promise.resolve({ host: '127.0.0.1', port: 5672 });
    });

    const http = require('http');
    const orig = http.request;
    http.request = (_options: any, cb: any) => {
      const res = { statusCode: 201 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    // mock amqplib connect success
    const amqp = require('amqplib');
    amqp.connect.mockResolvedValueOnce({
        createChannel: jest
          .fn()
          .mockResolvedValue({ close: jest.fn().mockResolvedValue(undefined) }),
        close: jest.fn().mockResolvedValue(undefined),
      }
    );

    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createRabbitMQService({
      id: 'r-clean',
      createService: createServiceMulti,
      env: { RABBITMQ_USERNAME: 'u', RABBITMQ_PASSWORD: 'p' } as any,
      waitToCloses,
    } as any);

    expect(res).toHaveProperty('channel');
    // calling cleanup should resolve
    await expect(waitToCloses[0]()).resolves.toBeUndefined();

    http.request = orig;
  });

  test('createRabbitMQService cleanup swallows channel/connection close errors', async () => {
    const createServiceMulti2 = jest.fn().mockImplementation((name: string) => {
      if (name.startsWith('rabbitmq-management'))
        return Promise.resolve({ host: '127.0.0.1', port: 15672 });
      return Promise.resolve({ host: '127.0.0.1', port: 5672 });
    });

    // mock http.request success for vhost
    const http2 = require('http');
    const orig2 = http2.request;
    http2.request = (options: any, cb: any) => {
      const res = { statusCode: 201 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    const amqp = require('amqplib');
    amqp.connect.mockResolvedValueOnce({
        createChannel: jest.fn().mockResolvedValue({
          close: jest.fn().mockRejectedValue(new Error('ch-close-fail')),
        }),
        close: jest.fn().mockRejectedValue(new Error('conn-close-fail')),
      }
    );

    const waitToCloses: Array<() => Promise<void>> = [];
    const _res2 = await createRabbitMQService({
      id: 'r-fail-clean',
      createService: createServiceMulti2,
      env: { RABBITMQ_USERNAME: 'u', RABBITMQ_PASSWORD: 'p' } as any,
      waitToCloses,
    } as any);

    // calling cleanup should not reject (errors are ignored)
    await expect(waitToCloses[0]()).resolves.toBeUndefined();

    http2.request = orig2;
  });

  test('ensureRabbitMqVhost treats missing statusCode as failure', async () => {
    const http = require('http');
    const orig = http.request;
    http.request = (_options: any, cb: any) => {
      const res: any = {}; // no statusCode
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow(/Failed to create vhost/);

    http.request = orig;
  });

  test('createRabbitMQService respects explicit amqpPort and mgmtPort', async () => {
    const createServiceMulti = jest
      .fn()
      .mockImplementation((name: string, port?: number) => {
        if (name.startsWith('rabbitmq-management'))
          return Promise.resolve({ host: '127.0.0.1', port: port ?? 15672 });
        return Promise.resolve({ host: '127.0.0.1', port: port ?? 5672 });
      });

    // mock http.request success for both calls
    const http = require('http');
    const orig = http.request;
    http.request = (options: any, cb: any) => {
      const res = { statusCode: 201 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    const amqp = require('amqplib');
    amqp.connect.mockResolvedValueOnce({
        createChannel: jest
          .fn()
          .mockResolvedValue({ close: jest.fn().mockResolvedValue(undefined) }),
        close: jest.fn().mockResolvedValue(undefined),
      }
    );

    const res = await createRabbitMQService({
      id: 'r-port',
      createService: createServiceMulti,
      amqpPort: 5673,
      mgmtPort: 15673,
      env: { RABBITMQ_USERNAME: 'u', RABBITMQ_PASSWORD: 'p' } as any,
    } as any);

    expect(res).toHaveProperty('channel');
    expect(createServiceMulti).toHaveBeenCalledWith('rabbitmq-r-port', 5673);
    expect(createServiceMulti).toHaveBeenCalledWith(
      'rabbitmq-management-r-port',
      15673
    );

    http.request = orig;
  });

  test('createRabbitMQService works when service has missing port/host values', async () => {
    const createServiceMulti = jest.fn().mockImplementation((name: string) => {
      if (name.startsWith('rabbitmq-management')) return Promise.resolve({});
      return Promise.resolve({});
    });

    const http = require('http');
    const orig = http.request;
    http.request = (options: any, cb: any) => {
      const res = { statusCode: 201 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    const amqp = require('amqplib');
    amqp.connect.mockResolvedValueOnce({
        createChannel: jest
          .fn()
          .mockResolvedValue({ close: jest.fn().mockResolvedValue(undefined) }),
        close: jest.fn().mockResolvedValue(undefined),
      }
    );

    // env provided so username/password are present
    const res = await createRabbitMQService({
      id: 'r-empty',
      createService: createServiceMulti,
      env: { RABBITMQ_USERNAME: 'u', RABBITMQ_PASSWORD: 'p' } as any,
    } as any);

    expect(res).toHaveProperty('channel');
    http.request = orig;
  });

  test('ensureRabbitMqVhost covers multiple status combinations', async () => {
    const http = require('http');
    const orig = http.request;

    const scenarios: Array<{
      first: any;
      second: any;
      shouldResolve: boolean;
    }> = [
      { first: 200, second: 200, shouldResolve: true },
      { first: 300, second: 200, shouldResolve: false },
      { first: 200, second: 300, shouldResolve: false },
      { first: 150, second: 250, shouldResolve: false },
    ];

    for (const s of scenarios) {
      let call = 0;
      http.request = (options: any, cb: any) => {
        call += 1;
        const code = call === 1 ? s.first : s.second;
        const res: any = { statusCode: code };
        setImmediate(() => cb(res));
        return { on: () => {}, write: () => {}, end: () => {} };
      };

      if (s.shouldResolve) {
        await expect(
          ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
        ).resolves.toBeUndefined();
      } else {
        await expect(
          ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
        ).rejects.toThrow();
      }
    }

    http.request = orig;
  });

  test('ensureRabbitMqVhost handles null statusCode and boundary 299', async () => {
    const http = require('http');
    const orig = http.request;

    // first call: null -> treated as 0 -> reject
    let call = 0;
    http.request = (options: any, cb: any) => {
      call += 1;
      const res: any = call === 1 ? { statusCode: null } : { statusCode: 299 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow();

    // now both true with 299
    http.request = (options: any, cb: any) => {
      const res: any = { statusCode: 299 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).resolves.toBeUndefined();

    http.request = orig;
  });

  test('ensureRabbitMqVhost exhaustive status permutations', async () => {
    const http = require('http');
    const orig = http.request;

    const statuses = [199, 200, 299, 300, null];

    for (const s1 of statuses) {
      for (const s2 of statuses) {
        let call = 0;
        http.request = (options: any, cb: any) => {
          call += 1;
          const code = call === 1 ? s1 : s2;
          const res: any = { statusCode: code };
          setImmediate(() => cb(res));
          return { on: () => {}, write: () => {}, end: () => {} };
        };

        const shouldResolve =
          s1 !== null &&
          typeof s1 === 'number' &&
          s1 >= 200 &&
          s1 < 300 &&
          s2 !== null &&
          typeof s2 === 'number' &&
          s2 >= 200 &&
          s2 < 300;

        if (shouldResolve) {
          await expect(
            ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
          ).resolves.toBeUndefined();
        } else {
          await expect(
            ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
          ).rejects.toThrow();
        }
      }
    }

    http.request = orig;
  });

  test('ensureRabbitMqVhost direct check for string and undefined status values', async () => {
    const http = require('http');
    const orig = http.request;

    // simulate first call with '200' string and second with undefined
    let call = 0;
    http.request = (options: any, cb: any) => {
      call += 1;
      const res: any = call === 1 ? { statusCode: '200' } : {};
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow();

    http.request = orig;
  });

  test('ensureRabbitMqVhost string/numeric permutations (extra)', async () => {
    const http = require('http');
    const orig = http.request;

    const scenarios = [
      { first: '200', second: '200', ok: true },
      { first: '199', second: '200', ok: false },
      { first: 200, second: '201', ok: true },
      { first: 201, second: 300, ok: false },
    ];

    for (const s of scenarios) {
      let call = 0;
      http.request = (options: any, cb: any) => {
        call += 1;
        const code = call === 1 ? s.first : s.second;
        const res: any = { statusCode: code };
        setImmediate(() => cb(res));
        return { on: () => {}, write: () => {}, end: () => {} };
      };

      if (s.ok)
        await expect(
          ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
        ).resolves.toBeUndefined();
      else
        await expect(
          ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
        ).rejects.toThrow();
    }

    http.request = orig;
  });

  test('ensureRabbitMqVhost handles statusCode getters (exercise branch evaluation)', async () => {
    const http = require('http');
    const orig = http.request;

    let call = 0;
    http.request = (options: any, cb: any) => {
      call += 1;
      if (call === 1) {
        const res: any = {
          get statusCode() {
            return 200;
          },
        };
        setImmediate(() => cb(res));
        return { on: () => {}, end: () => {} } as any;
      }
      const res: any = {
        get statusCode() {
          return 201;
        },
      };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} } as any;
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).resolves.toBeUndefined();

    http.request = orig;
  });

  test('ensureRabbitMqVhost vhost-status toggles between checks (first access true, second false)', async () => {
    const http = require('http');
    const orig = http.request;

    // First request (vhost creation) will have a statusCode getter that returns 200 on first access
    // and 350 on second access, causing the combined condition to evaluate to false.
    http.request = (options: any, cb: any) => {
      const res: any = {
        _cnt: 0,
        get statusCode() {
          this._cnt += 1;
          return this._cnt === 1 ? 200 : 350;
        },
      };
      setImmediate(() => cb(res));
      return { on: () => {}, end: () => {} } as any;
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow();

    http.request = orig;
  });

  test('ensureRabbitMqVhost permissions-status toggles between checks (first access true, second false)', async () => {
    const http = require('http');
    const orig = http.request;

    let call = 0;
    http.request = (options: any, cb: any) => {
      call += 1;
      if (call === 1) {
        // vhost creation succeeds
        const res = { statusCode: 201 };
        setImmediate(() => cb(res));
        return { on: () => {}, end: () => {} } as any;
      }

      // permissions call returns object whose getter returns 200 then 350
      const res: any = {
        _cnt: 0,
        get statusCode() {
          this._cnt += 1;
          return this._cnt === 1 ? 200 : 350;
        },
      };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} } as any;
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow();

    http.request = orig;
  });

  test('ensureRabbitMqVhost mid-range numeric combinations', async () => {
    const http = require('http');
    const orig = http.request;

    // both calls return 250 => should resolve
    http.request = (options: any, cb: any) => {
      const res: any = { statusCode: 250 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };
    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).resolves.toBeUndefined();

    // first ok, second not ok
    let call = 0;
    http.request = (options: any, cb: any) => {
      call += 1;
      const code = call === 1 ? 250 : 350;
      const res: any = { statusCode: code };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };
    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).rejects.toThrow();

    http.request = orig;
  });

  test('ensureRabbitMqVhost accepts string statusCode values', async () => {
    const http = require('http');
    const orig = http.request;

    http.request = (options: any, cb: any) => {
      const res: any = { statusCode: '201' };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    await expect(
      ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
    ).resolves.toBeUndefined();

    http.request = orig;
  });

  test('createRabbitMQService throws when createChannel fails', async () => {
    const createServiceMulti = jest.fn().mockImplementation((name: string) => {
      if (name.startsWith('rabbitmq-management'))
        return Promise.resolve({ host: '127.0.0.1', port: 15672 });
      return Promise.resolve({ host: '127.0.0.1', port: 5672 });
    });

    // mock http.request success for vhost
    const http = require('http');
    const orig = http.request;
    http.request = (options: any, cb: any) => {
      const res = { statusCode: 201 };
      setImmediate(() => cb(res));
      return { on: () => {}, write: () => {}, end: () => {} };
    };

    const amqp = require('amqplib');
    amqp.connect.mockResolvedValueOnce({
        createChannel: jest.fn().mockRejectedValue(new Error('ch-fail')),
        close: jest.fn().mockResolvedValue(undefined),
      }
    );

    await expect(
      createRabbitMQService({
        id: 'r-ch-fail',
        createService: createServiceMulti,
        env: { RABBITMQ_USERNAME: 'u', RABBITMQ_PASSWORD: 'p' } as any,
      })
    ).rejects.toThrow(/Failed to connect to RabbitMQ/);

    http.request = orig;
  });

  test('ensureRabbitMqVhost handles unusual statusCode types (NaN, booleans, objects)', async () => {
    const http = require('http');
    const orig = http.request;

    const statuses: any[] = [
      NaN,
      true,
      false,
      '250',
      '199',
      200,
      299,
      300,
      null,
      undefined,
      {},
    ];

    for (const s1 of statuses) {
      for (const s2 of statuses) {
        let call = 0;
        http.request = (options: any, cb: any) => {
          call += 1;
          const code = call === 1 ? s1 : s2;
          const res: any = { statusCode: code };
          setImmediate(() => cb(res));
          return { on: () => {}, write: () => {}, end: () => {} };
        };

        const n1 =
          typeof s1 === 'number' && !Number.isNaN(s1)
            ? s1
            : s1 == null
              ? 0
              : Number(s1);
        const n2 =
          typeof s2 === 'number' && !Number.isNaN(s2)
            ? s2
            : s2 == null
              ? 0
              : Number(s2);

        const ok1 = typeof n1 === 'number' && n1 >= 200 && n1 < 300;
        const ok2 = typeof n2 === 'number' && n2 >= 200 && n2 < 300;

        const shouldResolve = ok1 && ok2;

        if (shouldResolve) {
          await expect(
            ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
          ).resolves.toBeUndefined();
        } else {
          await expect(
            ensureRabbitMqVhost('localhost', 15672, 'v', 'u', 'p')
          ).rejects.toThrow();
        }
      }
    }

    http.request = orig;
  });
});
