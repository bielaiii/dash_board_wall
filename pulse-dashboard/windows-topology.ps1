Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class PulseCpuTopology {
  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool GetLogicalProcessorInformationEx(int relationship, IntPtr buffer, ref int length);
  public static string Read() {
    int length = 0;
    GetLogicalProcessorInformationEx(0, IntPtr.Zero, ref length);
    if (length <= 0) return "";
    IntPtr buffer = Marshal.AllocHGlobal(length);
    try {
      if (!GetLogicalProcessorInformationEx(0, buffer, ref length)) return "";
      var records = new List<string>();
      int offset = 0;
      while (offset < length) {
        int relationship = Marshal.ReadInt32(buffer, offset);
        int size = Marshal.ReadInt32(buffer, offset + 4);
        if (size < 40 || offset + size > length) break;
        if (relationship == 0) {
          int efficiency = Marshal.ReadByte(buffer, offset + 9);
          int groups = Marshal.ReadInt16(buffer, offset + 30);
          var logical = new List<int>();
          for (int g = 0; g < groups; g++) {
            int baseOffset = offset + 32 + g * 16;
            ulong mask = unchecked((ulong)Marshal.ReadInt64(buffer, baseOffset));
            int group = Marshal.ReadInt16(buffer, baseOffset + 8);
            for (int bit = 0; bit < 64; bit++) if ((mask & (1UL << bit)) != 0) logical.Add(group * 64 + bit);
          }
          records.Add(efficiency.ToString() + ":" + string.Join(",", logical));
        }
        offset += size;
      }
      return string.Join(";", records);
    } finally { Marshal.FreeHGlobal(buffer); }
  }
}
'@
[PulseCpuTopology]::Read()
