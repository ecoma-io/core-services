import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { libraryGenerator, ILibraryGeneratorSchema } from './generator';

describe('library generator', () => {
  let tree: Tree;
  const options: ILibraryGeneratorSchema = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    // Arrange: Create tree with empty workspace

    // Act: Execute the library generator
    await libraryGenerator(tree, options);

    // Assert: Verify the project configuration was created
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });
});
