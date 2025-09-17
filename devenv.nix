{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{
  packages = with pkgs; [
    git
    nodePackages.eslint_d
    prettierd
  ];

  languages.typescript.enable = true;
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    corepack.enable = true;
    pnpm.enable = true;
  };

}
