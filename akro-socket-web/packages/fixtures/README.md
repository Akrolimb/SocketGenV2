# Sample Fixtures

This directory contains sample mesh files and textures for testing the Akro Socket Generator.

## Meshes

### synthetic-cylinder.glb
A simple cylindrical mesh (400mm tall, 80mm diameter) representing a basic limb shape. Useful for testing basic functionality without the complexity of an actual limb scan.

### sample-limb.glb  
A realistic prosthetic limb mesh with:
- Proper scale (approximately 350mm tall)
- Texture coordinates for marking detection
- Anatomically accurate shape for below-knee prosthetic

## Textures

### markings.png
A test texture showing various colored markings:
- Red lines for trimlines
- Green areas for relief zones  
- Blue areas for loading zones
- Yellow points for landmarks

## Usage

These fixtures can be used for:
1. **Development testing** - Quick validation of features during development
2. **Unit tests** - Automated testing of geometry processing functions
3. **Demo purposes** - Showing the application capabilities to users
4. **Performance testing** - Benchmarking with known mesh sizes

## Creating Your Own Test Files

For additional test files:
1. Export from CAD software as GLB with textures
2. Ensure proper scale (mm units preferred)
3. Add colored markings to textures if testing auto-detection
4. Keep file sizes reasonable (<10MB) for quick loading

## File Specifications

- **Units**: Millimeters (mm) preferred
- **Coordinate system**: Y-up (standard for glTF)
- **Texture resolution**: 1024x1024 or 2048x2048
- **Triangle count**: 50k-200k for good performance
- **File format**: GLB preferred for single-file portability