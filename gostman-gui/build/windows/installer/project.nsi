Unicode true
SetCompressor /SOLID lzma

####
## Please note: Template replacements don't work in this file. They are provided with default defines like
## mentioned underneath.
## If the keyword is not defined, "wails_tools.nsh" will populate them with the values from ProjectInfo.
## If they are defined here, "wails_tools.nsh" will not touch them. This allows to use this project.nsi manually
## from outside of Wails for debugging and development of the installer.
##
## For development first make a wails nsis build to populate the "wails_tools.nsh":
## > wails build --target windows/amd64 --nsis
## Then you can call makensis on this file with specifying the path to your binary:
## For a AMD64 only installer:
## > makensis -DARG_WAILS_AMD64_BINARY=..\..\bin\app.exe
## For a ARM64 only installer:
## > makensis -DARG_WAILS_ARM64_BINARY=..\..\bin\app.exe
## For a installer with both architectures:
## > makensis -DARG_WAILS_AMD64_BINARY=..\..\bin\app-amd64.exe -DARG_WAILS_ARM64_BINARY=..\..\bin\app-arm64.exe
####
## The following information is taken from the ProjectInfo file, but they can be overwritten here.
####
## !define INFO_PROJECTNAME    "MyProject" # Default "{{.Name}}"
## !define INFO_COMPANYNAME    "MyCompany" # Default "{{.Info.CompanyName}}"
## !define INFO_PRODUCTNAME    "MyProduct" # Default "{{.Info.ProductName}}"
## !define INFO_PRODUCTVERSION "1.0.0"     # Default "{{.Info.ProductVersion}}"
## !define INFO_COPYRIGHT      "Copyright" # Default "{{.Info.Copyright}}"
###
## !define PRODUCT_EXECUTABLE  "Application.exe"      # Default "${INFO_PROJECTNAME}.exe"
## !define UNINST_KEY_NAME     "UninstKeyInRegistry"  # Default "${INFO_COMPANYNAME}${INFO_PRODUCTNAME}"
####
## !define REQUEST_EXECUTION_LEVEL "admin"            # Default "admin"  see also https://nsis.sourceforge.io/Docs/Chapter4.html
####
## Include the wails tools
####
!include "wails_tools.nsh"
!include "Sections.nsh"
!include "gostman_path.nsh"

!ifndef ARG_CLI_BINARY
    !define ARG_CLI_BINARY "..\..\..\..\cli-staging\windows-amd64\gostman.exe"
!endif
!if /FileExists "${ARG_CLI_BINARY}"
!else
    !error "The command line build is missing: ${ARG_CLI_BINARY}. Build ./cmd/gostman for windows/amd64 into that path first."
!endif

# The version information for this two must consist of 4 parts
VIProductVersion "${INFO_PRODUCTVERSION}.0"
VIFileVersion    "${INFO_PRODUCTVERSION}.0"

VIAddVersionKey "CompanyName"     "${INFO_COMPANYNAME}"
VIAddVersionKey "FileDescription" "${INFO_PRODUCTNAME} Installer"
VIAddVersionKey "ProductVersion"  "${INFO_PRODUCTVERSION}"
VIAddVersionKey "FileVersion"     "${INFO_PRODUCTVERSION}"
VIAddVersionKey "LegalCopyright"  "${INFO_COPYRIGHT}"
VIAddVersionKey "ProductName"     "${INFO_PRODUCTNAME}"

# Enable HiDPI support. https://nsis.sourceforge.io/Reference/ManifestDPIAware
ManifestDPIAware true

!include "MUI.nsh"

!define MUI_ICON "..\icon.ico"
!define MUI_UNICON "..\icon.ico"
# !define MUI_WELCOMEFINISHPAGE_BITMAP "resources\leftimage.bmp" #Include this to add a bitmap on the left side of the Welcome Page. Must be a size of 164x314
!define MUI_FINISHPAGE_NOAUTOCLOSE # Wait on the INSTFILES page so the user can take a look into the details of the installation steps
!define MUI_ABORTWARNING # This will warn the user if they exit from the installer.

!insertmacro MUI_PAGE_WELCOME # Welcome to the installer page.
# !insertmacro MUI_PAGE_LICENSE "resources\eula.txt" # Adds a EULA page to the installer
!insertmacro MUI_PAGE_COMPONENTS # Which parts to install.
!insertmacro MUI_PAGE_DIRECTORY # In which folder install page.
!insertmacro MUI_PAGE_INSTFILES # Installing page.
!insertmacro MUI_PAGE_FINISH # Finished installation page.

!insertmacro MUI_UNPAGE_INSTFILES # Uinstalling page

!insertmacro MUI_LANGUAGE "English" # Set the Language of the installer

## The following two statements can be used to sign the installer and the uninstaller. The path to the binaries are provided in %1
#!uninstfinalize 'signtool --file "%1"'
#!finalize 'signtool --file "%1"'

Name "${INFO_PRODUCTNAME}"
!if "${REQUEST_EXECUTION_LEVEL}" == "user"
    !define UNINST_ROOT HKCU
    !define OTHER_ROOT HKLM
    !define OTHER_SCOPE_WARNING "Gostman is already installed for all users. Installing it for your account only gives you two copies. Continue?"
    !define ENV_ROOT HKCU
    !define ENV_KEY "Environment"
    !define PATH_SECTION_NAME "Add the command line tool to your PATH"
    OutFile "..\..\bin\${INFO_PROJECTNAME}-${ARCH}-user-installer.exe"
    InstallDir "$LOCALAPPDATA\Programs\${INFO_PRODUCTNAME}"
!else
    !define UNINST_ROOT HKLM
    !define OTHER_ROOT HKCU
    !define OTHER_SCOPE_WARNING "Gostman is already installed for your account only. Installing it for all users gives you two copies. Continue?"
    !define ENV_ROOT HKLM
    !define ENV_KEY "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"
    !define PATH_SECTION_NAME "Add the command line tool to the system PATH"
    OutFile "..\..\bin\${INFO_PROJECTNAME}-${ARCH}-installer.exe" # Name of the installer's file.
    InstallDir "$PROGRAMFILES64\${INFO_COMPANYNAME}\${INFO_PRODUCTNAME}" # Default installing folder ($PROGRAMFILES is Program Files folder).
!endif
ShowInstDetails show # This will always show the installation details.

!insertmacro gostman.pathFunctions "" ${ENV_ROOT} "${ENV_KEY}"
!insertmacro gostman.pathFunctions "un." ${ENV_ROOT} "${ENV_KEY}"

!macro gostman.writeUninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"

    SetRegView 64
    WriteRegStr ${UNINST_ROOT} "${UNINST_KEY}" "Publisher" "${INFO_COMPANYNAME}"
    WriteRegStr ${UNINST_ROOT} "${UNINST_KEY}" "DisplayName" "${INFO_PRODUCTNAME}"
    WriteRegStr ${UNINST_ROOT} "${UNINST_KEY}" "DisplayVersion" "${INFO_PRODUCTVERSION}"
    WriteRegStr ${UNINST_ROOT} "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    WriteRegStr ${UNINST_ROOT} "${UNINST_KEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
    WriteRegStr ${UNINST_ROOT} "${UNINST_KEY}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"

    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD ${UNINST_ROOT} "${UNINST_KEY}" "EstimatedSize" "$0"

    !if "${REQUEST_EXECUTION_LEVEL}" == "user"
        FileOpen $0 "$INSTDIR\per-user" w
        FileClose $0
    !endif
!macroend

!macro gostman.deleteUninstaller
    Delete "$INSTDIR\uninstall.exe"

    SetRegView 64
    DeleteRegKey ${UNINST_ROOT} "${UNINST_KEY}"
!macroend

Section "Gostman" SecApp
    SectionIn RO
    !insertmacro wails.setShellContext

    !insertmacro wails.webview2runtime

    SetOutPath $INSTDIR

    !insertmacro wails.files

    CreateShortcut "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    CreateShortCut "$DESKTOP\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"

    !insertmacro wails.associateFiles
    !insertmacro wails.associateCustomProtocols

SectionEnd

Section "Command line tool" SecCli
    SetOutPath "$INSTDIR\cli"

    Delete "$INSTDIR\cli\gostman.old"
    ${If} ${FileExists} "$INSTDIR\cli\gostman.exe"
        Rename "$INSTDIR\cli\gostman.exe" "$INSTDIR\cli\gostman.old"
    ${EndIf}
    ClearErrors
    SetOverwrite try
    File "/oname=gostman.exe" "${ARG_CLI_BINARY}"
    SetOverwrite on
    ${If} ${Errors}
        ${IfNot} ${FileExists} "$INSTDIR\cli\gostman.exe"
            Rename "$INSTDIR\cli\gostman.old" "$INSTDIR\cli\gostman.exe"
        ${EndIf}
        DetailPrint "The command line tool is in use, so it was left as it was. Close it and run the installer again to update it."
    ${Else}
        Delete "$INSTDIR\cli\gostman.old"
    ${EndIf}
SectionEnd

Section "${PATH_SECTION_NAME}" SecPath
    StrCpy $R8 "add"
    StrCpy $R9 "$INSTDIR\cli"
    !if "${REQUEST_EXECUTION_LEVEL}" != "user"
        StrLen $0 "$PROGRAMFILES64"
        StrCpy $1 "$INSTDIR" $0
        ${If} $1 != "$PROGRAMFILES64"
            StrCpy $R8 "unsafe"
        ${EndIf}
    !endif
    ${If} $R8 == "add"
        Call gostmanPathEdit
    ${EndIf}
    ${If} $R8 == "added"
        !insertmacro gostman.broadcastEnvironment
        DetailPrint "Added $INSTDIR\cli to the PATH. Open a new terminal to use it."
    ${ElseIf} $R8 == "unsafe"
        DetailPrint "Not adding $INSTDIR\cli to the system PATH: the install folder is outside Program Files, where any user could change it."
    ${ElseIf} $R8 == "badname"
        DetailPrint "Not adding $INSTDIR\cli to the PATH: the folder name has a ; or a % in it."
        MessageBox MB_OK|MB_ICONINFORMATION "The install folder has a ; or a % in its name, which the PATH cannot hold safely, so the PATH was left as it is.$\r$\n$\r$\nInstall to another folder to use gostman from a terminal, or run it by its full path:$\r$\n$INSTDIR\cli\gostman.exe" /SD IDOK
    ${ElseIf} $R8 == "toolong"
        DetailPrint "The PATH is too long to change safely. Add $INSTDIR\cli to it yourself."
        MessageBox MB_OK|MB_ICONINFORMATION "The PATH is too long for the installer to change safely, so it was left as it is.$\r$\n$\r$\nTo type gostman in a terminal, add this folder to the PATH yourself:$\r$\n$INSTDIR\cli" /SD IDOK
    ${EndIf}
SectionEnd

Section "-Finish"
    !insertmacro gostman.writeUninstaller
    SetRegView 64
    ${If} ${SectionIsSelected} ${SecCli}
    ${OrIf} ${FileExists} "$INSTDIR\cli\gostman.exe"
        WriteRegDWORD ${UNINST_ROOT} "${UNINST_KEY}" "GostmanCli" 1
    ${Else}
        WriteRegDWORD ${UNINST_ROOT} "${UNINST_KEY}" "GostmanCli" 0
    ${EndIf}
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecApp} "The Gostman desktop app."
    !insertmacro MUI_DESCRIPTION_TEXT ${SecCli} "The gostman command for terminals, CI and coding agents, installed next to the app."
    !insertmacro MUI_DESCRIPTION_TEXT ${SecPath} "Lets you type gostman in any new terminal."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Function .onInit
    !insertmacro wails.checkArchitecture

    SetRegView 64
    ReadRegStr $0 ${OTHER_ROOT} "${UNINST_KEY}" "UninstallString"
    ${If} $0 != ""
        MessageBox MB_YESNO|MB_ICONEXCLAMATION "${OTHER_SCOPE_WARNING}" /SD IDYES IDYES +2
        Abort
    ${EndIf}

    ${If} ${Silent}
    ${AndIf} ${FileExists} "$INSTDIR\uninstall.exe"
        ClearErrors
        ReadRegDWORD $0 ${UNINST_ROOT} "${UNINST_KEY}" "GostmanCli"
        ${IfNot} ${Errors}
        ${AndIf} $0 == 0
            !insertmacro UnselectSection ${SecCli}
        ${EndIf}
        StrCpy $R8 "has"
        StrCpy $R9 "$INSTDIR\cli"
        Call gostmanPathEdit
        ${If} $R8 != "yes"
            !insertmacro UnselectSection ${SecPath}
        ${EndIf}
    ${EndIf}

    ${GetParameters} $R0
    StrCpy $R1 ""
    ${GetOptions} $R0 "/PATH=" $R1
    ${If} $R1 == "0"
        !insertmacro UnselectSection ${SecPath}
    ${ElseIf} $R1 == "1"
        !insertmacro SelectSection ${SecCli}
        !insertmacro SelectSection ${SecPath}
    ${EndIf}
    StrCpy $R1 ""
    ${GetOptions} $R0 "/CLI=" $R1
    ${If} $R1 == "0"
        !insertmacro UnselectSection ${SecCli}
        !insertmacro UnselectSection ${SecPath}
    ${ElseIf} $R1 == "1"
        !insertmacro SelectSection ${SecCli}
    ${EndIf}
FunctionEnd

Function .onSelChange
    ${IfNot} ${SectionIsSelected} ${SecCli}
        !insertmacro UnselectSection ${SecPath}
    ${EndIf}
FunctionEnd

Section "uninstall"
    !insertmacro wails.setShellContext

    RMDir /r "$AppData\${PRODUCT_EXECUTABLE}" # Remove the WebView2 DataPath

    StrCpy $R8 "remove"
    StrCpy $R9 "$INSTDIR\cli"
    Call un.gostmanPathEdit
    ${If} $R8 == "removed"
        !insertmacro gostman.broadcastEnvironment
    ${EndIf}

    Delete "$INSTDIR\${PRODUCT_EXECUTABLE}"
    Delete "$INSTDIR\cli\gostman.exe"
    Delete "$INSTDIR\cli\gostman.old"
    RMDir "$INSTDIR\cli"
    Delete "$INSTDIR\per-user"

    Delete "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk"
    Delete "$DESKTOP\${INFO_PRODUCTNAME}.lnk"

    !insertmacro wails.unassociateFiles
    !insertmacro wails.unassociateCustomProtocols

    !insertmacro gostman.deleteUninstaller
    RMDir "$INSTDIR"
SectionEnd
