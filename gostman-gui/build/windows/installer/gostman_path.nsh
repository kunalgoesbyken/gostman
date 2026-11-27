!ifndef GOSTMAN_PATH_NSH
!define GOSTMAN_PATH_NSH

!define GOSTMAN_PATH_LIMIT 1023

!macro gostman.pathFunctions PREFIX ROOT KEY
    Function ${PREFIX}gostmanPathLong
        InitPluginsDir
        FileOpen $0 "$PLUGINSDIR\gostman_path.ps1" w
        FileWrite $0 "param($$Mode,$$Dir,$$Hive,$$Key)$\r$\n"
        FileWrite $0 "$$ErrorActionPreference='Stop'$\r$\n"
        FileWrite $0 "$$root=if($$Hive -eq 'HKLM'){[Microsoft.Win32.Registry]::LocalMachine}else{[Microsoft.Win32.Registry]::CurrentUser}$\r$\n"
        FileWrite $0 "$$k=$$root.OpenSubKey($$Key,$$true)$\r$\n"
        FileWrite $0 "$$v=[string]$$k.GetValue('Path','',[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)$\r$\n"
        FileWrite $0 "$$parts=if($$v -eq ''){@()}else{$$v.Split(';')}$\r$\n"
        FileWrite $0 "$$hit=@($$parts|Where-Object{$$_ -ieq $$Dir}).Count -gt 0$\r$\n"
        FileWrite $0 "if($$Mode -eq 'add'){if($$hit){'present';exit 0}$\r$\n"
        FileWrite $0 "$$new=if($$v -eq ''){$$Dir}elseif($$v.EndsWith(';')){$$v+$$Dir}else{$$v+';'+$$Dir}$\r$\n"
        FileWrite $0 "$$k.SetValue('Path',$$new,[Microsoft.Win32.RegistryValueKind]::ExpandString);'added';exit 0}$\r$\n"
        FileWrite $0 "if(-not $$hit){'absent';exit 0}$\r$\n"
        FileWrite $0 "$$left=($$parts|Where-Object{$$_ -ine $$Dir}) -join ';'$\r$\n"
        FileWrite $0 "if($$left -eq ''){$$k.DeleteValue('Path')}else{$$k.SetValue('Path',$$left,[Microsoft.Win32.RegistryValueKind]::ExpandString)}$\r$\n"
        FileWrite $0 "'removed'$\r$\n"
        FileClose $0
        nsExec::ExecToStack '"powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\gostman_path.ps1" $R8 "$R9" ${ROOT} "${KEY}"'
        Pop $0
        Pop $1
        Delete "$PLUGINSDIR\gostman_path.ps1"
        StrCpy $R8 "toolong"
        StrCmp $0 0 0 done
        StrCpy $2 $1 5
        StrCmp $2 "added" 0 +3
        StrCpy $R8 "added"
        Goto done
        StrCpy $2 $1 7
        StrCmp $2 "present" 0 +3
        StrCpy $R8 "present"
        Goto done
        StrCmp $2 "removed" 0 +3
        StrCpy $R8 "removed"
        Goto done
        StrCpy $2 $1 6
        StrCmp $2 "absent" 0 done
        StrCpy $R8 "absent"
        done:
    FunctionEnd

    Function ${PREFIX}gostmanPathEdit
        StrCmp $R8 "add" 0 dirChecked
        StrCpy $6 0
        checkDir:
            StrCpy $7 $R9 1 $6
            StrCmp $7 "" dirChecked
            StrCmp $7 ";" badName
            StrCmp $7 "%" badName
            IntOp $6 $6 + 1
            Goto checkDir
        badName:
        StrCpy $R8 "badname"
        Return
        dirChecked:
        SetRegView 64
        ClearErrors
        ReadRegStr $1 ${ROOT} "${KEY}" "Path"
        IfErrors 0 readable
        StrCpy $1 ""
        StrCpy $0 0
        look:
            EnumRegValue $6 ${ROOT} "${KEY}" $0
            IfErrors readable
            StrCmp $6 "Path" unreadable
            IntOp $0 $0 + 1
            Goto look
        unreadable:
        StrCmp $R8 "has" missing
        Goto tooLong
        readable:
        StrLen $2 $1
        StrCpy $3 $1
        StrCpy $4 ""
        StrCpy $5 0
        StrCpy $8 0

        next:
            StrCpy $6 0
            scan:
                StrCpy $7 $3 1 $6
                StrCmp $7 "" tokenEnd
                StrCmp $7 ";" tokenEnd
                IntOp $6 $6 + 1
                Goto scan
            tokenEnd:
            StrCpy $0 $3 $6
            StrCmp $0 $R9 0 keep
            StrCpy $8 1
            Goto advance
            keep:
                StrCmp $5 0 first
                StrCpy $4 "$4;$0"
                Goto kept
                first:
                StrCpy $4 $0
                kept:
                IntOp $5 $5 + 1
            advance:
                StrCmp $7 "" scanned
                IntOp $6 $6 + 1
                StrCpy $3 $3 "" $6
                Goto next
        scanned:

        StrCmp $R8 "has" has
        StrCmp $R8 "add" add

        StrCmp $8 1 0 absent
        StrCmp $4 "" emptied
        WriteRegExpandStr ${ROOT} "${KEY}" "Path" $4
        Goto removed
        emptied:
        DeleteRegValue ${ROOT} "${KEY}" "Path"
        removed:
        StrCpy $R8 "removed"
        Return
        absent:
        StrCpy $R8 "absent"
        Return

        has:
        StrCmp $8 1 0 missing
        StrCpy $R8 "yes"
        Return
        missing:
        StrCpy $R8 "no"
        Return

        add:
        StrCmp $8 1 0 append
        StrCpy $R8 "present"
        Return
        append:
        IntCmp $2 ${GOSTMAN_PATH_LIMIT} tooLong fits tooLong
        fits:
        StrLen $R0 $R9
        IntOp $R0 $R0 + $2
        IntOp $R0 $R0 + 1
        IntCmp $R0 ${GOSTMAN_PATH_LIMIT} fitsExact fitsLess tooLong
        fitsExact:
        fitsLess:
        StrCmp $2 0 only
        StrCpy $R0 $1 1 -1
        StrCmp $R0 ";" joined
        WriteRegExpandStr ${ROOT} "${KEY}" "Path" "$1;$R9"
        Goto added
        joined:
        WriteRegExpandStr ${ROOT} "${KEY}" "Path" "$1$R9"
        Goto added
        only:
        WriteRegExpandStr ${ROOT} "${KEY}" "Path" "$R9"
        added:
        StrCpy $R8 "added"
        Return

        tooLong:
        Call ${PREFIX}gostmanPathLong
    FunctionEnd
!macroend

!macro gostman.broadcastEnvironment
    SendMessage 0xFFFF 0x001A 0 "STR:Environment" /TIMEOUT=5000
!macroend

!endif
