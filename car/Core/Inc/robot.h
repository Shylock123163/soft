#ifndef __ROBOT_H
#define __ROBOT_H

#include "main.h"
#include <stdint.h>

typedef enum {
    STATE_BOOT_PREPARE = 0,
    STATE_SEARCH_STRAFE,
    STATE_LOCK_TARGET,
    STATE_FORWARD_TO_TARGET,
    STATE_GRAB_CLOSE,
    STATE_TURN_LEFT_180,
    STATE_EXIT_STRAIGHT,
    STATE_RELEASE,
    STATE_PUSH_FORWARD,
    STATE_PUSH_BACKWARD,
    STATE_RETURN_TURN_LEFT_180,
    STATE_DONE,
    STATE_ERROR,
} RobotState_t;

typedef enum {
    SERVO_CMD_NONE = 0,
    SERVO_CMD_OPEN,
    SERVO_CMD_CLOSE,
} ServoCmd_t;

typedef enum {
    CLOSE_REASON_NONE = 0,
    CLOSE_REASON_DISTANCE,
    CLOSE_REASON_FRONT_SWITCH,
} CloseReason_t;

extern volatile uint16_t     g_vision_detect_min_count;
extern volatile uint16_t     g_vision_raw_trigger;
extern volatile uint16_t     g_vision_smooth_trigger;
extern volatile uint16_t     g_vision_decision_trigger;
extern volatile uint16_t     g_push_distance_divisor;
extern volatile uint16_t     g_push_distance_min_mm;
extern volatile uint16_t     g_servo_open_angle;
extern volatile uint16_t     g_servo_close_angle;
extern volatile RobotState_t g_robot_state;
extern volatile uint8_t      g_bumper_left;
extern volatile uint8_t      g_bumper_right;
extern volatile uint8_t      g_grab_switch_front;
extern volatile uint8_t      g_front_switch_triggered;
extern volatile uint8_t      g_vision_detected;
extern volatile uint8_t      g_vision_position; /* 当前实现中等同于 detected，占位保留 */
extern volatile uint16_t     g_vision_distance; /* 策略前进距离，不是真实测距 */
extern volatile uint16_t     g_vision_smooth;
extern volatile uint16_t     g_vision_raw;
extern volatile uint16_t     g_vision_decision;
extern volatile uint16_t     g_target_forward_mm;
extern volatile uint16_t     g_forward_progress_mm;
extern volatile CloseReason_t g_close_reason;
extern volatile uint16_t     g_dist_left;
extern volatile uint16_t     g_dist_top;
extern volatile uint16_t     g_dist_front;
extern volatile uint16_t     g_dist_right;
extern volatile uint16_t     g_top_inside_ref;
extern volatile uint8_t      g_exit_confirmed;
extern volatile uint32_t     g_state_timer;
extern volatile ServoCmd_t   g_servo_cmd;
extern volatile uint8_t      g_servo_busy;
extern volatile int          g_enc1;
extern volatile int          g_enc2;
extern volatile int          g_enc3;
extern volatile int          g_enc4;
extern volatile int16_t      g_target_speed[4];

#endif /* __ROBOT_H */
