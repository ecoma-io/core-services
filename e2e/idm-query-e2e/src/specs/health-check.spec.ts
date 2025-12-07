import { loadFeature, defineFeature } from 'jest-cucumber';
import { TestEnvironment } from '../support/test.environment';
import { AxiosResponse } from 'axios';

const feature = loadFeature('../features/liveness-health-check.feature', {
  loadRelativePath: true,
});

defineFeature(feature, (test) => {
  const environment = new TestEnvironment();
  let response: AxiosResponse;

  beforeAll(async () => {
    // Start containers and prepare http client
    await environment.start();
  }, 60000);

  afterAll(async () => {
    // Tear down environment
    await environment.stop();
  }, 30000);

  test('Kiểm tra liveness healthy trả về trạng thái healthy', ({
    given,
    when,
    then,
  }) => {
    given(
      'tiến trình dịch vụ `idm-query` đã được khởi động và đang chạy',
      () => {
        // beforeAll already started the environment; sanity check client
        expect(environment.idmQueryApiClient).toBeDefined();
      }
    );

    when('operator hoặc orchestrator gọi `GET /health/liveness`', async () => {
      response = await environment.idmQueryApiClient.get('/health/liveness');
    });

    then('dịch vụ trả về HTTP 200', () => {
      expect(response.status).toBe(200);
    });

    then(
      'nội dung response có trường `message` = "Service still alive"',
      () => {
        expect(response.data.message).toBe('Service still alive');
      }
    );
  });
});
