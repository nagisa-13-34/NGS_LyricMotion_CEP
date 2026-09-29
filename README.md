# NGS LyricMotion

After Effects の選択レイヤーに、文字単位のイン／アウトアニメーションを設定する CEP パネルです。

## 機能

- テキストレイヤーを表示文字ごとのテキストレイヤーに分けてアニメーションします。空白と改行は分割対象から除きます。元のテキストレイヤーは残りますが、適用後は非表示になります。
- テキスト以外の選択レイヤーには、レイヤー単位でアニメーションを設定します。
- 位置（X／Y／Z）、イン／アウトの長さ、レイヤーごとの開始時間のずらしを調整できます。Z位置は3Dレイヤーで使われます。
- 入力した移動値を使う1方向、X／Y軸をランダムに選ぶ2方向、軸と正負をランダムに選ぶ4方向を選べます。レイヤー順の反転も設定できます。
- イン／アウトそれぞれのベジェカーブを編集できます。
- 不透明度、スケール、Z軸回転のアニメーションを追加できます。
- 設定をプリセットとして保存・削除できます。プリセットは利用者のユーザーデータ内に保存されます。

テキストレイヤーへの適用では、文字レイヤーを複製して作成し、選択した設定に沿って位置や変形のキーフレームを設定します。大切なコンポジションでは、適用前にプロジェクトを保存してください。

## 動作環境

- Adobe After Effects と CEP 11 ランタイム
- ソースからビルドする場合は Node.js と npm

現在のZXPはWindows上で作成・署名した配布物です。macOSでの署名・インストールは確認していません。

## インストール

### ZXPを使う

1. [GitHub Releases](https://github.com/nagisa-13-34/NGS_LyricMotion_CEP/releases/latest) から `NGS_LyricMotion_0.1.0_Windows.zxp` をダウンロードします。
2. CEP拡張に対応したZXPインストーラーでインストールします。
3. After Effectsを再起動し、`ウィンドウ > エクステンション`または`ウィンドウ > エクステンション（レガシー）`から「NGS LyricMotion」を開きます。表示されるメニュー名はAfter Effectsのバージョンと言語設定によって異なることがあります。

このZXPは自己署名証明書で署名しており、署名のタイムスタンプは付いていません。証明書の有効期限は2036-09-27です。一般の認証局が発行する証明書による署名ではないため、インストーラーが拒否する場合は下の開発用インストール手順を使ってください。CEPのZXP署名とインストールについては[Adobe CEPのガイド](https://github.com/Adobe-CEP/Getting-Started-guides/blob/master/Package%20Distribute%20Install/readme.md)を参照してください。

## 使い方

1. After Effectsでコンポジションを開き、アニメーションさせるレイヤーを選択します。
2. パネルでイン／アウトの動きと各レイヤー設定を調整します。
3. 「適用」を押します。

適用にはアクティブなコンポジションと1つ以上の選択レイヤーが必要です。テキストレイヤーは空白・改行を除いて文字ごとのテキストレイヤーに分かれ、選択した他のレイヤーはレイヤー単位で処理されます。

### Windowsでソースからインストールする

CEPの開発用拡張を読み込むため、管理者権限の不要なユーザー単位の設定を有効にし、After Effectsを再起動します。

```powershell
New-Item -Path 'HKCU:\Software\Adobe\CSXS.11' -Force | Out-Null
New-ItemProperty -Path 'HKCU:\Software\Adobe\CSXS.11' -Name PlayerDebugMode -PropertyType String -Value '1' -Force | Out-Null
```

続いて、リポジトリのルートで次を実行します。

```powershell
npm ci
npm run deploy
```

`npm run deploy`はビルド後、`%APPDATA%\Adobe\CEP\extensions\com.ngs.lyricmotion`に拡張を配置します。同じ場所にある既存の拡張フォルダーを削除して置き換えるため、必要なファイルがある場合は先にバックアップしてください。配置後、After Effectsを再起動します。

## ソースからビルドする

```powershell
npm ci
npm run build
```

ビルド結果は`dist/`に出力されます。ロジックテストは`npm test`で実行できます。

## ZXPを作り直す

ZXPのパッケージ作成と署名には、Adobeの[ZXPSignCmd](https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD)を使います。Windows向けのZXPSignCmdを用意し、`npm run build`を実行してください。初めて署名する場合は、次のPowerShell例で自己署名証明書を作成します。証明書ファイル（`.p12`）はリポジトリの外に保管してください。

```powershell
$signer = 'C:\tools\ZXPSignCmd.exe'
$certificate = Join-Path $env:USERPROFILE 'lyricmotion.p12'
$securePassword = Read-Host '証明書のパスワード' -AsSecureString
$password = [System.Net.NetworkCredential]::new('', $securePassword).Password

& $signer -selfSignedCert JP Tokyo NGS 'NGS LyricMotion' $password $certificate -validityDays 3650
if ($LASTEXITCODE -ne 0) { throw '証明書を作成できませんでした' }
```

ビルド結果を一時フォルダーへコピーし、開発用の`.debug`を除いて署名・検証します。

```powershell
$stage = Join-Path $env:TEMP ('NGS_LyricMotion_ZXP_' + [Guid]::NewGuid().ToString('N'))
$output = '.\release\NGS_LyricMotion_0.1.0_Windows.zxp'

Copy-Item -LiteralPath '.\dist' -Destination $stage -Recurse
Remove-Item -LiteralPath (Join-Path $stage '.debug') -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path '.\release' -Force | Out-Null

& $signer -sign $stage $output $certificate $password
if ($LASTEXITCODE -ne 0) { throw 'ZXPの署名に失敗しました' }

& $signer -verify $output
if ($LASTEXITCODE -ne 0) { throw 'ZXPの署名を検証できませんでした' }
```

`release/`はGit管理対象外です。GitHubへ配布するときは、`.p12`証明書ではなく検証済みの`.zxp`だけをReleaseに添付してください。

## リポジトリ構成

- `src/` — CEPパネルのReact UIと設定・プリセット処理
- `CSXS/manifest.xml` — CEP拡張の識別情報と起動設定
- `CSXS/hostscript.jsx` — After Effects内で実行するアニメーション処理
- `DecomposeTextParts.jsx` — テキストをシェイプ化してパーツに分ける単体スクリプト
- `NGS_TextSplitter.jsx` — テキストを文字・単語・行単位に分けるScriptUIスクリプト
- `tests/` — ホストスクリプトのロジックテストとAE用スモークスクリプト

上記2つの単体JSXスクリプトは、CEPパネルやZXPには含まれません。

## 注意事項

- アニメーション適用時、位置や変形プロパティに既存のキーフレームがある場合は置き換えられます。
- テキストを文字単位に分けるには、After Effectsの「テキストからシェイプを作成」機能を使います。使用フォントや文字の形によっては分解に失敗することがあります。
- 文字レイヤーのエフェクトが元レイヤーを参照する式を含む場合、該当する項目は自動変更されず、パネルに警告が表示されます。
