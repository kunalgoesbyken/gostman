!ifndef GOSTMAN_PATH_NSH
!define GOSTMAN_PATH_NSH

!define GOSTMAN_PATH_LIMIT 1023

!macro gostman.pathFunctions PREFIX ROOT KEY
    Function ${PREFIX}gostmanPathEdit
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
        StrCpy $R8 "toolong"
    FunctionEnd
!macroend

!macro gostman.broadcastEnvironment
    SendMessage 0xFFFF 0x001A 0 "STR:Environment" /TIMEOUT=5000
!macroend

!endif
