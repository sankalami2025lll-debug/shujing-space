import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

describe('ModelsController launch view routes', () => {
  const user = { id: BigInt(7), role: 'user' as const };
  const modelId = 123;

  let service: {
    findOne: jest.Mock;
    saveLaunchView: jest.Mock;
    clearLaunchView: jest.Mock;
  };
  let controller: ModelsController;

  beforeEach(() => {
    service = {
      findOne: jest.fn(),
      saveLaunchView: jest.fn(),
      clearLaunchView: jest.fn(),
    };
    controller = new ModelsController(service as unknown as ModelsService);
  });

  it('detail 继续透传 launchView 详情查询', async () => {
    service.findOne.mockResolvedValue({
      id: modelId,
      userId: 7,
      title: '模型',
      type: '三维实景重建',
      tags: [],
      scenes: [],
      description: '',
      author: '作者A',
      category: null,
      coverUrl: '',
      viewerUrl: 'https://example.com/model.lcc',
      viewerType: 'native',
      allowIframe: false,
      fileFormat: 'lcc',
      viewsCount: 0,
      likesCount: 0,
      favoritesCount: 0,
      createdAt: new Date('2026-06-06T00:00:00.000Z'),
      processingStatus: 'ready',
      launchView: null,
      canSaveLaunchView: false,
    });

    const result = await controller.detail(undefined, modelId);

    expect(service.findOne).toHaveBeenCalledWith(BigInt(modelId), undefined);
    expect(result.canSaveLaunchView).toBe(false);
  });

  it('saveLaunchView 调用 service 并透传用户 id', async () => {
    service.saveLaunchView.mockResolvedValue({
      launchView: {
        version: 1,
        viewerKind: 'lcc',
        snapshot: {
          position: [0, 2, 6],
          target: [0, 2, 0],
          up: [0, 1, 0],
          near: 0.1,
          far: 5000,
        },
      },
      updatedAt: new Date('2026-06-06T00:00:00.000Z'),
      updatedBy: 7,
    });

    const payload = {
      version: 1,
      viewerKind: 'lcc',
      snapshot: {
        position: [0, 2, 6],
        target: [0, 2, 0],
        up: [0, 1, 0],
        near: 0.1,
        far: 5000,
      },
    };

    const result = await controller.saveLaunchView(user, modelId, payload);

    expect(service.saveLaunchView).toHaveBeenCalledWith(user.id, BigInt(modelId), payload);
    expect(result.updatedBy).toBe(7);
  });

  it('clearLaunchView 调用 service 并透传用户 id', async () => {
    service.clearLaunchView.mockResolvedValue({
      launchView: null,
      cleared: true,
    });

    const result = await controller.clearLaunchView(user, modelId);

    expect(service.clearLaunchView).toHaveBeenCalledWith(user.id, BigInt(modelId));
    expect(result).toEqual({ launchView: null, cleared: true });
  });
});
