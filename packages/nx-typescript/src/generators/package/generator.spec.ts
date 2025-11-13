import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { packageGenerator, IpackageGeneratorSchema } from './generator';

describe('package generator', () => {
  let tree: Tree;
  const options: IpackageGeneratorSchema = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    // Arrange: Create tree with empty workspace

    // Act: Execute the package generator
    await packageGenerator(tree, options);

    // Assert: Verify the project configuration was created
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });
});
