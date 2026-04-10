  #include "servo.h"
  #include "tim.h"
  #include "robot.h"

  static uint16_t Servo_AngleToPulse(uint8_t
  angle)
  {
      if (angle > 180) angle = 180;
      return (uint16_t)(500 + (angle * 2000)
  / 180);
  }

  void Servo_SetAngle(uint8_t servo_id,
  uint8_t angle)
  {
      uint16_t pulse =
  Servo_AngleToPulse(angle);

      if (servo_id == 1)
      {
          __HAL_TIM_SET_COMPARE(&htim8,
  TIM_CHANNEL_4, pulse);
      }
  }

  void Servo_Open(uint8_t servo_id)
  {
      Servo_SetAngle(servo_id,
  (uint8_t)g_servo_open_angle);
  }

  void Servo_Close(uint8_t servo_id)
  {
      Servo_SetAngle(servo_id,
  (uint8_t)g_servo_close_angle);
  }
 
  void TIM8_SwitchToServo(void)
  {
      HAL_TIM_PWM_Stop_DMA(&htim8,
  TIM_CHANNEL_3);
      HAL_TIM_Base_DeInit(&htim8);

      MX_TIM8_Servo_Init();
      HAL_TIM_PWM_Start(&htim8,
  TIM_CHANNEL_4);
  }
  