; Inno Setup script for Tiny Remote
; Build the app first (see PACKAGING.md), then compile this script with the staged files.

#define MyAppName "Tiny Remote"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Tiny Remote"
#define MyAppURL "https://github.com/your-repo/tiny-remote"
#define MyAppExeName "Tiny Remote.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=output
OutputBaseFilename=TinyRemote-Setup-{#MyAppVersion}
Compression=lz2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
; Firewall rule requires admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startupicon"; Description: "Start Tiny Remote when I log in"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
; Staged app files (run scripts\build-installer.bat from repo root first)
Source: "stage\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Add firewall rule so phone/other devices can connect without Windows blocking
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -NoProfile -Command ""& { Get-NetFirewallRule -DisplayName 'Tiny Remote' -ErrorAction SilentlyContinue | Remove-NetFirewallRule; New-NetFirewallRule -DisplayName 'Tiny Remote' -Direction Inbound -Protocol TCP -LocalPort 8765 -Action Allow -Profile Private,Domain }"""; \
  Flags: runhidden waituntilterminated; \
  StatusMsg: "Adding firewall rule for local network access..."

[UninstallRun]
; Remove firewall rule on uninstall
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -NoProfile -Command ""Remove-NetFirewallRule -DisplayName 'Tiny Remote' -ErrorAction SilentlyContinue"""; \
  Flags: runhidden waituntilterminated

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  StartupFolder: String;
  PsCmd: String;
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    if WizardIsTaskSelected('startupicon') then
    begin
      StartupFolder := ExpandConstant('{userstartup}');
      PsCmd := '-ExecutionPolicy Bypass -NoProfile -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut(''' + StartupFolder + '\Tiny Remote.lnk''); $s.TargetPath = ''' + ExpandConstant('{app}\{#MyAppExeName}') + '''; $s.Save()"';
      Exec('powershell.exe', PsCmd, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;
