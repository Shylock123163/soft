#include "chassis.h"
#include "motor.h"
#include "encoder.h"
#include "robot.h"
#include "HWT101.h"
#include "cmsis_os.h"

static const int16_t chassis_start_pwm = 40;
static const int16_t chassis_pwm_limit = 80;
static const int16_t chassis_wheel_trim[4] = {0, 4, 0, 2};
static const int16_t chassis_straight_trim = 0;
static const int16_t chassis_strafe_trim = 0;

static const float chassis_heading_yaw_kp = 2.1f;
static const float chassis_heading_gyro_kd = 0.12f;
static const float chassis_heading_limit = 12.0f;
static const float chassis_heading_dir = -1.0f;
static const float chassis_turn180_fast_angle = 150.0f;
static const float chassis_turn180_stop_angle = 177.7f;
static const int16_t chassis_turn180_fast_pwm = 35;
static const int16_t chassis_turn180_slow_pwm = 24;

static uint8_t s_heading_locked = 0;
static float s_heading_target_yaw = 0.0f;
static uint8_t s_turn180_started = 0;
static uint8_t s_turn180_done = 0;
static int8_t s_turn180_dir = 1;
static float s_turn180_start_yaw = 0.0f;

static int16_t Chassis_ClampS16(int16_t value, int16_t min, int16_t max)
{
    if (value > max)
    {
        return max;
    }
    if (value < min)
    {
        return min;
    }
    return value;
}

static float Chassis_ClampFloat(float value, float min, float max)
{
    if (value > max)
    {
        return max;
    }
    if (value < min)
    {
        return min;
    }
    return value;
}

static float Chassis_NormalizeAngle(float angle)
{
    while (angle > 180.0f)
    {
        angle -= 360.0f;
    }
    while (angle < -180.0f)
    {
        angle += 360.0f;
    }
    return angle;
}

static void Chassis_ReadEncoder(int enc[4])
{
    enc[0] = -Read_Encoder_TIM2();
    enc[1] = Read_Encoder_TIM3();
    enc[2] = -Read_Encoder_TIM5();
    enc[3] = -Read_Encoder_TIM4();

    g_enc1 = enc[0];
    g_enc2 = enc[1];
    g_enc3 = enc[2];
    g_enc4 = enc[3];
}

static void Chassis_ClearHeadingLock(void)
{
    s_heading_locked = 0;
    s_heading_target_yaw = 0.0f;
}

static int16_t Chassis_ComputeHeadingComp(void)
{
    float yaw_err;
    float yaw_comp;

    if (!s_heading_locked)
    {
        s_heading_target_yaw = fAngle[2];
        s_heading_locked = 1;
    }

    yaw_err = Chassis_NormalizeAngle(s_heading_target_yaw - fAngle[2]);
    yaw_comp = chassis_heading_dir *
               (chassis_heading_yaw_kp * yaw_err - chassis_heading_gyro_kd * fGyro[2]);
    yaw_comp = Chassis_ClampFloat(yaw_comp,
                                  -chassis_heading_limit,
                                  chassis_heading_limit);

    return (int16_t)yaw_comp;
}

static int16_t Chassis_ApplySignedTrim(int16_t pwm, int16_t trim)
{
    if (pwm > 0)
    {
        pwm += trim;
    }
    else if (pwm < 0)
    {
        pwm -= trim;
    }

    return Chassis_ClampS16(pwm, -chassis_pwm_limit, chassis_pwm_limit);
}

static float Chassis_AbsFloat(float value)
{
    return (value >= 0.0f) ? value : -value;
}

static void Chassis_SetOpenLoopPWM(int16_t pwm1,
                                   int16_t pwm2,
                                   int16_t pwm3,
                                   int16_t pwm4)
{
    pwm1 = Chassis_ApplySignedTrim(pwm1, chassis_wheel_trim[0]);
    pwm2 = Chassis_ApplySignedTrim(pwm2, chassis_wheel_trim[1]);
    pwm3 = Chassis_ApplySignedTrim(pwm3, chassis_wheel_trim[2]);
    pwm4 = Chassis_ApplySignedTrim(pwm4, chassis_wheel_trim[3]);

    Motor_SetPWM(pwm1, pwm2, pwm3, pwm4);
}

void Chassis_Init(void)
{
    g_target_speed[0] = 0;
    g_target_speed[1] = 0;
    g_target_speed[2] = 0;
    g_target_speed[3] = 0;
    Chassis_ClearHeadingLock();
}

void Chassis_ResetPID(void)
{
    g_target_speed[0] = 0;
    g_target_speed[1] = 0;
    g_target_speed[2] = 0;
    g_target_speed[3] = 0;
    Chassis_ClearHeadingLock();
}

void Chassis_Stop(void)
{
    g_target_speed[0] = 0;
    g_target_speed[1] = 0;
    g_target_speed[2] = 0;
    g_target_speed[3] = 0;
    Chassis_ClearHeadingLock();
    Motor_Stop();
}

  void Chassis_Forward_OpenLoop(int16_t pwm)
  {
      g_target_speed[0] = 0;
      g_target_speed[1] = 0;
      g_target_speed[2] = 0;
      g_target_speed[3] = 0;

      Chassis_RunStraightPID(Chassis_ClampS16(pwm,
   0, chassis_pwm_limit));
  }

 /* �÷�
  while (1)
  {
      HWT101_GetValue();
      Chassis_Forward_OpenLoop(45);
      HAL_Delay(10);
  }
  
  */
  void Chassis_Backward_OpenLoop(int16_t pwm)
  {

      g_target_speed[0] = 0;
      g_target_speed[1] = 0;
      g_target_speed[2] = 0;
      g_target_speed[3] = 0;


  Chassis_RunStraightPID(-Chassis_ClampS16(pwm, 0,
   chassis_pwm_limit));
  }
  
void Chassis_MoveLeft_OpenLoop(int16_t pwm)
{
    g_target_speed[0] = 0;
    g_target_speed[1] = 0;
    g_target_speed[2] = 0;
    g_target_speed[3] = 0;
    Chassis_ClearHeadingLock();
    Motor_MoveLeft(pwm);
}

void Chassis_MoveRight_OpenLoop(int16_t pwm)
{
    g_target_speed[0] = 0;
    g_target_speed[1] = 0;
    g_target_speed[2] = 0;
    g_target_speed[3] = 0;
    Chassis_ClearHeadingLock();
    Motor_MoveRight(pwm);
}

void Chassis_TurnLeft_OpenLoop(int16_t pwm)
{
    g_target_speed[0] = 0;
    g_target_speed[1] = 0;
    g_target_speed[2] = 0;
    g_target_speed[3] = 0;
    Chassis_ClearHeadingLock();
    Motor_TurnLeft(pwm);
}

void Chassis_TurnRight_OpenLoop(int16_t pwm)
{
    g_target_speed[0] = 0;
    g_target_speed[1] = 0;
    g_target_speed[2] = 0;
    g_target_speed[3] = 0;
    Chassis_ClearHeadingLock();
    Motor_TurnRight(pwm);
}

void Chassis_StartStraight(void)
{
    Motor_SetPWM(chassis_start_pwm,
                 chassis_start_pwm,
                 -chassis_start_pwm,
                 -chassis_start_pwm);
    osDelay(200);
    Motor_Stop();
    osDelay(100);
    Chassis_ResetPID();
}

void Chassis_StartTurnLeft180(void)
{
    s_turn180_start_yaw = fAngle[2];
    s_turn180_started = 1;
    s_turn180_done = 0;
    s_turn180_dir = 1;
    Chassis_ClearHeadingLock();
}

uint8_t Chassis_RunTurnLeft180(void)
{
    float delta_yaw;
    float abs_delta_yaw;

    if (!s_turn180_started || (s_turn180_dir != 1))
    {
        Chassis_StartTurnLeft180();
    }

    if (s_turn180_done)
    {
        Chassis_Stop();
        return 1U;
    }

    delta_yaw = Chassis_NormalizeAngle(fAngle[2] - s_turn180_start_yaw);
    abs_delta_yaw = Chassis_AbsFloat(delta_yaw);

    if (abs_delta_yaw < chassis_turn180_fast_angle)
    {
        Chassis_TurnLeft_OpenLoop(chassis_turn180_fast_pwm);
    }
    else if (abs_delta_yaw < chassis_turn180_stop_angle)
    {
        Chassis_TurnLeft_OpenLoop(chassis_turn180_slow_pwm);
    }
    else
    {
        Chassis_Stop();
        s_turn180_done = 1;
        return 1U;
    }

    return 0U;
}

void Chassis_StartTurnRight180(void)
{
    s_turn180_start_yaw = fAngle[2];
    s_turn180_started = 1;
    s_turn180_done = 0;
    s_turn180_dir = -1;
    Chassis_ClearHeadingLock();
}

uint8_t Chassis_RunTurnRight180(void)
{
    float delta_yaw;
    float abs_delta_yaw;

    if (!s_turn180_started || (s_turn180_dir != -1))
    {
        Chassis_StartTurnRight180();
    }

    if (s_turn180_done)
    {
        Chassis_Stop();
        return 1U;
    }

    delta_yaw = Chassis_NormalizeAngle(fAngle[2] - s_turn180_start_yaw);
    abs_delta_yaw = Chassis_AbsFloat(delta_yaw);
 printf("[TURN_R] start=%.2f yaw=%.2f delta=%.2f abs=%.2f\r\n",s_turn180_start_yaw,
         fAngle[2],
         delta_yaw,
         abs_delta_yaw);
    if (abs_delta_yaw < chassis_turn180_fast_angle)
    {
        Chassis_TurnRight_OpenLoop(chassis_turn180_fast_pwm);
    }
    else if (abs_delta_yaw < chassis_turn180_stop_angle)
    {
        Chassis_TurnRight_OpenLoop(chassis_turn180_slow_pwm);
    }
    else
    {
        Chassis_Stop();
        s_turn180_done = 1;
        return 1U;
    }

    return 0U;
}

 void Chassis_RunStraightPID(int16_t
  target_speed)
  {
      int16_t turn_comp;
      int16_t base_pwm;

      turn_comp = Chassis_ComputeHeadingComp();
      base_pwm = Chassis_ClampS16(target_speed,
  -chassis_pwm_limit, chassis_pwm_limit);

      Chassis_SetOpenLoopPWM(base_pwm - turn_comp
  - chassis_straight_trim,
                             base_pwm + turn_comp
  + chassis_straight_trim,
                             -base_pwm - turn_comp
   - chassis_straight_trim,
                             -base_pwm + turn_comp
   + chassis_straight_trim);
  }

void Chassis_RunStrafeLeftPID(int16_t target_speed)
{
    int16_t turn_comp;
    int16_t base_pwm;

    turn_comp = Chassis_ComputeHeadingComp();
    base_pwm = Chassis_ClampS16(target_speed, -chassis_pwm_limit, chassis_pwm_limit);

    Chassis_SetOpenLoopPWM(-base_pwm - turn_comp + chassis_strafe_trim,
                           base_pwm + turn_comp + chassis_strafe_trim,
                           base_pwm - turn_comp + chassis_strafe_trim,
                           -base_pwm + turn_comp + chassis_strafe_trim);
}
  
//   void Chassis_RunStrafeLeftPID(int16_t
//  target_speed)
//  {
//      int16_t turn_comp;
//      int16_t base_pwm;

//      turn_comp = 0;
//      base_pwm = Chassis_ClampS16(target_speed,
//  -chassis_pwm_limit, chassis_pwm_limit);

//      Chassis_SetOpenLoopPWM(-base_pwm -
//  turn_comp + chassis_strafe_trim,
//                             base_pwm + turn_comp
//   + chassis_strafe_trim,
//                             base_pwm - turn_comp
//   + chassis_strafe_trim,
//                             -base_pwm +
//  turn_comp + chassis_strafe_trim);
//  }
 void Chassis_RunStrafeRightPID(int16_t target_speed)
  {
	  
      if (target_speed < 0)
      {
          target_speed = -target_speed;
      }

      Chassis_RunStrafeLeftPID(-target_speed);
  }

void Chassis_DebugWheelPID(int16_t s1, int16_t s2, int16_t s3, int16_t s4)
{
    Chassis_SetOpenLoopPWM(s1, s2, s3, s4);
}