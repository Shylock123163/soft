/*
 * sweep_bushu 串口协议示例
 *
 * 鲁班猫发送:
 *   $SWEEP,1,823,801,823,CLUTTER\r\n
 *   $SWEEP,0,112,101,888,CLEAN\r\n
 *
 * 字段说明:
 *   1. 帧头       $SWEEP
 *   2. clutter    1=前方有杂物, 0=前方无杂物
 *   3. smooth     滤波后的 clutter 概率, 0~1000
 *   4. raw        原始 clutter 概率, 0~1000
 *   5. decision   最终状态置信度, 0~1000
 *   6. state      CLUTTER / CLEAN / UNKNOWN
 *
 * 电控若只关心有没有杂物, 只解析第 2 个字段即可.
 */

#include <string.h>
#include <stdlib.h>

static char rx_line[96];
static int rx_index = 0;
static int g_has_clutter = 0;

void VisionProtocol_OnChar(char ch)
{
    if (ch == '\r') {
        return;
    }

    if (ch == '\n') {
        char *token;
        char *ctx = NULL;
        int field_index = 0;

        rx_line[rx_index] = '\0';
        rx_index = 0;

        token = strtok_r(rx_line, ",", &ctx);
        while (token != NULL) {
            field_index++;
            if (field_index == 1) {
                if (strcmp(token, "$SWEEP") != 0) {
                    return;
                }
            } else if (field_index == 2) {
                g_has_clutter = atoi(token) ? 1 : 0;
                return;
            }
            token = strtok_r(NULL, ",", &ctx);
        }
        return;
    }

    if (rx_index < (int)(sizeof(rx_line) - 1)) {
        rx_line[rx_index++] = ch;
    } else {
        rx_index = 0;
    }
}

int VisionProtocol_HasClutter(void)
{
    return g_has_clutter;
}
