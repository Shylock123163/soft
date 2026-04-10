#ifndef __SERVO_H
#define __SERVO_H

#include "main.h"
#include "cmsis_os.h"

#define SERVO_OPEN_ANGLE    32
#define SERVO_CLOSE_ANGLE   165

void Servo_DWT_Init(void);
void Servo_SetAngle(uint8_t servo_id, uint8_t angle);
void Servo_Open(uint8_t servo_id);
void Servo_Close(uint8_t servo_id);
void TIM8_SwitchToServo(void);

#endif