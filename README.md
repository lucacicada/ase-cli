# ASE CLI

Aseprite CLI.

It extract all layers, visible or not, from an Aseprite file to a directory.

It also outputs a `aseprite.json` file with all the information about the file.



```bash
pnpm dlx ase-cli --outDir=./extracted ./input.aseprite
```

# Why

The default Aseprite CLI is not that great...

It does not output a full `.json`, nor it allow to name layers by their index position, `{layer}` refers to the layer name, that is not unique.

For game development you need flexibility, and this tool provides that.
