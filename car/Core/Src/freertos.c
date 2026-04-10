/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * File Name          : freertos.c
  * Description        : Code for freertos applications
  ******************************************************************************
  */
/* USER CODE END Header */

/* Includes ------------------------------------------------------------------*/
#include "FreeRTOS.h"
#include "task.h"
#include "main.h"
#include "cmsis_os.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include "encoder.h"
#include "usart.h"
#include "motor.h"
#include "servo.h"
#include "tim.h"
#include "vl53l0x.h"
#include "robot.h"
#include "chassis.h"
#include "HWT101.h"
#include "ws2812b.h"
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */
/* 比赛调参接口：舵机和串口/视觉参数放最前面，比赛时优先改这里 */
volatile uint16_t g_vision_detect_min_count = 2U;
volatile uint16_t g_vision_raw_trigger = 380U;
volatile uint16_t g_vision_smooth_trigger = 550U;
volatile uint16_t g_vision_decision_trigger = 600U;
volatile uint16_t g_push_distance_divisor = 2U;
volatile uint16_t g_push_distance_min_mm = 50U;
volatile uint16_t g_servo_open_angle = 31U;
volatile uint16_t g_servo_close_angle = 165U;
/*
 * g_vision_detect_min_count:
 *   1 = 更灵敏，更容易触发；2 = 默认；3 = 更稳，但更容易错过
 * g_vision_raw_trigger / g_vision_smooth_trigger / g_vision_decision_trigger:
 *   数值越小越松，越大越严
 *   推荐先调 detect_min_count，再调 decision_trigger，最后微调 raw/smooth
 * g_push_distance_divisor:
 *   推出距离 = 本次抓取前进距离 / divisor，默认 2 表示一半
 * g_push_distance_min_mm:
 *   推出距离下限，避免一半后太短
 * g_servo_open_angle / g_servo_close_angle:
 *   爪子张开/闭合角度；当前把 open 从 32 下调到 31，减少释放后卡住风险
 */
/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */
#define SEARCH_SPEED                38
#define APPROACH_SPEED              28
#define BACKOUT_SPEED              (-25)
#define SEARCH_TIMEOUT_MS        300000U
#define FORWARD_TIMEOUT_MS       30000U
#define GRAB_TIMEOUT_MS           2500U
#define TURN_TIMEOUT_MS          15000U
#define EXIT_TIMEOUT_MS          30000U
#define PUSH_TIMEOUT_MS           5000U
#define SERVO_MOVE_TIME_MS         700U
#define VISION_RX_BUF_SIZE        128U
#define VISION_SCORE_MAX         1000U
/* 这里先按 1 count = 1 mm 留接口，后面按实车再标定 */
#define ENCODER_MM_PER_COUNT      1.0f
#define FIXED_TRAVEL_MM           4000U

#define VISION_NEAR_SMOOTH         750U
#define VISION_MID_SMOOTH          600U
#define VISION_NEAR_TRAVEL_MM     2800U
#define VISION_MID_TRAVEL_MM      3400U

#define ROBOT_SM_TEST_COMM    0
#define ROBOT_SM_TEST_SENSOR  1  //测试：1  启用：0
#define ROBOT_SM_TEST_SERVO   0
#define ROBOT_SM_TEST_IMU     0
#define ROBOT_SM_DEBUG_PRINT  1

#define BOOT_LIGHT_WAIT_MS        4000U
/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */
/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/
/* USER CODE BEGIN Variables */
volatile int g_enc1 = 0;
volatile int g_enc2 = 0;
volatile int g_enc3 = 0;
volatile int g_enc4 = 0;

volatile int16_t g_target_speed[4] = {0, 0, 0, 0};

volatile RobotState_t g_robot_state = STATE_BOOT_PREPARE;

volatile uint8_t g_vision_detected = 0;
volatile uint8_t g_vision_position = 0;
volatile uint16_t g_vision_distance = 0;
volatile uint16_t g_vision_smooth = 0;
volatile uint16_t g_vision_raw = 0;
volatile uint16_t g_vision_decision = 0;
volatile uint16_t g_target_forward_mm = 0;
volatile uint16_t g_forward_progress_mm = 0;
volatile CloseReason_t g_close_reason = CLOSE_REASON_NONE;

volatile uint8_t g_bumper_left = 0;
volatile uint8_t g_bumper_right = 0;
volatile uint8_t g_grab_switch_front = 0;
volatile uint8_t g_front_switch_triggered = 0;

volatile uint16_t g_dist_left = 9999;
volatile uint16_t g_dist_top = 9999;
volatile uint16_t g_dist_front = 9999;
volatile uint16_t g_dist_right = 9999;
volatile uint16_t g_top_inside_ref = 0;
volatile uint8_t g_exit_confirmed = 0;

volatile uint32_t g_state_timer = 0;
volatile ServoCmd_t g_servo_cmd = SERVO_CMD_NONE;
volatile uint8_t g_servo_busy = 0;

static uint32_t s_forward_encoder_accum = 0;
static uint8_t s_vision_rx_buf[VISION_RX_BUF_SIZE];
static volatile uint16_t s_vision_rx_size = 0;
static volatile uint8_t s_vision_rx_ready = 0;
/* USER CODE END Variables */
osThreadId MotorTaskHandle;
osThreadId EncoderTaskHandle;
osThreadId IMUTaskHandle;
osThreadId SensorTaskHandle;
osThreadId ServoTaskHandle;
osThreadId LedTaskHandle;
osThreadId CommTaskHandle;

/* Private function prototypes -----------------------------------------------*/
/* USER CODE BEGIN FunctionPrototypes */
static uint8_t VisionDetectedStable(void);
static uint16_t Robot_EstimateForwardMm(void);
static uint16_t Robot_ComputePushTravelMm(uint16_t forward_mm);
static uint8_t StateTimedOut(uint32_t timeout_ms);
static void EnterState(RobotState_t next_state);
static uint8_t RobotNeedLight(void);
static uint32_t Robot_AbsS32(int32_t value);
static void Robot_ClearFrontSwitchLatch(void);
static void Robot_ResetForwardProgress(void);
static void Robot_UpdateEncoderSnapshot(void);
static void Robot_UpdateForwardProgress(void);
static void Robot_VisionRxStart(void);
__weak void Robot_VisionProtocol_Poll(void);
static uint8_t Robot_ParseVisionScore(const char *token, uint16_t *out_value);
static void Robot_ResetVisionData(void);
static void Robot_StateMachineTestStep(void);
static const char *Robot_StateName(RobotState_t state);
/* USER CODE END FunctionPrototypes */

void StartMotorTask(void const * argument);
void StartEncoderTask(void const * argument);
void StartIMUTask(void const * argument);
void StartSensorTask(void const * argument);
void StartServoTask(void const * argument);
void StartLedTask(void const * argument);
void StartCommTask(void const * argument);

void MX_FREERTOS_Init(void); /* (MISRA C 2004 rule 8.1) */

/* GetIdleTaskMemory prototype (linked to static allocation support) */
void vApplicationGetIdleTaskMemory( StaticTask_t **ppxIdleTaskTCBBuffer, StackType_t **ppxIdleTaskStackBuffer, uint32_t *pulIdleTaskStackSize );

/* USER CODE BEGIN GET_IDLE_TASK_MEMORY */
static StaticTask_t xIdleTaskTCBBuffer;
static StackType_t xIdleStack[configMINIMAL_STACK_SIZE];

void vApplicationGetIdleTaskMemory( StaticTask_t **ppxIdleTaskTCBBuffer, StackType_t **ppxIdleTaskStackBuffer, uint32_t *pulIdleTaskStackSize )
{
  *ppxIdleTaskTCBBuffer = &xIdleTaskTCBBuffer;
  *ppxIdleTaskStackBuffer = &xIdleStack[0];
  *pulIdleTaskStackSize = configMINIMAL_STACK_SIZE;
}
/* USER CODE END GET_IDLE_TASK_MEMORY */

void MX_FREERTOS_Init(void) {
  /* USER CODE BEGIN Init */
  /* USER CODE END Init */

  /* USER CODE BEGIN RTOS_MUTEX */
  /* USER CODE END RTOS_MUTEX */

  /* USER CODE BEGIN RTOS_SEMAPHORES */
  /* USER CODE END RTOS_SEMAPHORES */

  /* USER CODE BEGIN RTOS_TIMERS */
  /* USER CODE END RTOS_TIMERS */

  /* USER CODE BEGIN RTOS_QUEUES */
  /* USER CODE END RTOS_QUEUES */

  /* Create the thread(s) */
  osThreadDef(MotorTask, StartMotorTask, osPriorityHigh, 0, 512);
  MotorTaskHandle = osThreadCreate(osThread(MotorTask), NULL);

  osThreadDef(EncoderTask, StartEncoderTask, osPriorityAboveNormal, 0, 512);
  EncoderTaskHandle = osThreadCreate(osThread(EncoderTask), NULL);

  osThreadDef(IMUTask, StartIMUTask, osPriorityNormal, 0, 512);
  IMUTaskHandle = osThreadCreate(osThread(IMUTask), NULL);

  osThreadDef(SensorTask, StartSensorTask, osPriorityNormal, 0, 512);
  SensorTaskHandle = osThreadCreate(osThread(SensorTask), NULL);

  osThreadDef(ServoTask, StartServoTask, osPriorityBelowNormal, 0, 256);
  ServoTaskHandle = osThreadCreate(osThread(ServoTask), NULL);

  osThreadDef(LedTask, StartLedTask, osPriorityLow, 0, 256);
  LedTaskHandle = osThreadCreate(osThread(LedTask), NULL);

  osThreadDef(CommTask, StartCommTask, osPriorityLow, 0, 1024);
  CommTaskHandle = osThreadCreate(osThread(CommTask), NULL);

  /* USER CODE BEGIN RTOS_THREADS */
  /* USER CODE END RTOS_THREADS */
}

void StartMotorTask(void const * argument)
{
  /* USER CODE BEGIN StartMotorTask */
  RobotState_t last_state;
  uint8_t entered;

  (void)argument;
  Motor_Init();
  Chassis_Init();
  last_state = STATE_ERROR;
  EnterState(STATE_BOOT_PREPARE);

  for (;;)
  {
    entered = (g_robot_state != last_state) ? 1U : 0U;
    if (entered != 0U)
    {
      last_state = g_robot_state;
    }

    switch (g_robot_state)
    {
      /* 启动准备：停车、开爪、亮灯等待 */
      case STATE_BOOT_PREPARE:
    if (entered != 0U)
    {
      Chassis_Stop();
      Robot_ClearFrontSwitchLatch();
      Robot_ResetForwardProgress();
      g_target_forward_mm = 0;
      g_close_reason = CLOSE_REASON_NONE;
      g_exit_confirmed = 0U;
      g_top_inside_ref = 0U;
      g_servo_cmd = SERVO_CMD_OPEN;
    }

    if ((g_servo_busy == 0U) &&
        (g_servo_cmd == SERVO_CMD_NONE) &&
        (StateTimedOut(BOOT_LIGHT_WAIT_MS) != 0U))
    {
      EnterState(STATE_SEARCH_STRAFE);
    }
    break;

      /* 搜索目标：持续左移，直到视觉稳定识别 */
      case STATE_SEARCH_STRAFE:
        Chassis_RunStrafeLeftPID(SEARCH_SPEED);
        if (VisionDetectedStable() != 0U)
        {
          Chassis_Stop();
          EnterState(STATE_LOCK_TARGET);
        }
        else if (StateTimedOut(SEARCH_TIMEOUT_MS) != 0U)
        {
          EnterState(STATE_ERROR);
        }
        break;

      /* 锁定目标：写死本次前进距离并清零里程 */
      case STATE_LOCK_TARGET:
        Chassis_Stop();
        if (entered != 0U)
        {
          g_target_forward_mm = Robot_EstimateForwardMm();
          g_top_inside_ref = g_dist_top;
          g_close_reason = CLOSE_REASON_NONE;
          g_exit_confirmed = 0U;
          Robot_ClearFrontSwitchLatch();
          Robot_ResetForwardProgress();
        }
        EnterState(STATE_FORWARD_TO_TARGET);
        break;

      /* 前进抓取：按固定距离前进，抓取时把实际前进里程记下来，供后退等距使用 */
      case STATE_FORWARD_TO_TARGET:
        Chassis_RunStraightPID(APPROACH_SPEED);
        if (g_front_switch_triggered != 0U)
        {
          Chassis_Stop();
          g_target_forward_mm = g_forward_progress_mm;
          g_close_reason = CLOSE_REASON_FRONT_SWITCH;
          EnterState(STATE_GRAB_CLOSE);
        }
        else if (g_forward_progress_mm >= g_target_forward_mm)
        {
          Chassis_Stop();
          g_target_forward_mm = g_forward_progress_mm;
          g_close_reason = CLOSE_REASON_DISTANCE;
          EnterState(STATE_GRAB_CLOSE);
        }
        else if (StateTimedOut(FORWARD_TIMEOUT_MS) != 0U)
        {
          EnterState(STATE_ERROR);
        }
        break;

      /* 闭爪抓取：抓到目标后先停车并闭合夹爪 */
      case STATE_GRAB_CLOSE:
        Chassis_Stop();
        if (entered != 0U)
        {
          g_servo_cmd = SERVO_CMD_CLOSE;
        }

        if ((g_servo_busy == 0U) && (g_servo_cmd == SERVO_CMD_NONE))
        {
          Robot_ResetForwardProgress();
          EnterState(STATE_EXIT_STRAIGHT);
        }
        else if (StateTimedOut(GRAB_TIMEOUT_MS) != 0U)
        {
          EnterState(STATE_ERROR);
        }
        break;

      /* 左转掉头：后退完成后原地左转 180 度 */
  case STATE_TURN_LEFT_180:
    if (entered != 0U)
    {
      Chassis_StartTurnLeft180();
    }
    if (Chassis_RunTurnLeft180() != 0U)
    {
      EnterState(STATE_RELEASE);
    }
    else if (StateTimedOut(TURN_TIMEOUT_MS) != 0U)
    {
      EnterState(STATE_ERROR);
    }
    break;
      /* 退出后退：按与前进相同的固定距离直线后退，并直接按编码器里程结束 */
      case STATE_EXIT_STRAIGHT:
        g_exit_confirmed = (g_forward_progress_mm >= g_target_forward_mm) ? 1U : 0U;
        printf("[EXIT] progress=%u target=%u confirm=%u\r\n",
               g_forward_progress_mm, g_target_forward_mm, g_exit_confirmed);
        Chassis_RunStraightPID(BACKOUT_SPEED);

        if (g_forward_progress_mm >= g_target_forward_mm)
        {
          Chassis_Stop();
          EnterState(STATE_TURN_LEFT_180);
        }
        else if (StateTimedOut(EXIT_TIMEOUT_MS) != 0U)
        {
          EnterState(STATE_ERROR);
        }
        break;

      /* 释放目标：左转完成后张爪，为推出杂物做准备 */
      case STATE_RELEASE:
        Chassis_Stop();
        if (entered != 0U)
        {
          g_servo_cmd = SERVO_CMD_OPEN;
        }

        if ((g_servo_busy == 0U) && (g_servo_cmd == SERVO_CMD_NONE))
        {
          Robot_ResetForwardProgress();
          g_target_forward_mm = Robot_ComputePushTravelMm(g_target_forward_mm);
          EnterState(STATE_PUSH_FORWARD);
        }
        else if (StateTimedOut(GRAB_TIMEOUT_MS) != 0U)
        {
          EnterState(STATE_ERROR);
        }
        break;

      /* 前推杂物：保持白灯，向前固定距离将杂物推出 */
      case STATE_PUSH_FORWARD:
        Chassis_RunStraightPID(APPROACH_SPEED);
        if (g_forward_progress_mm >= g_target_forward_mm)
        {
          Chassis_Stop();
          Robot_ResetForwardProgress();
          EnterState(STATE_PUSH_BACKWARD);
        }
        else if (StateTimedOut(PUSH_TIMEOUT_MS) != 0U)
        {
          EnterState(STATE_ERROR);
        }
        break;

      /* 后退回位：按相同固定距离后退，回到掉头前附近位置 */
      case STATE_PUSH_BACKWARD:
        Chassis_RunStraightPID(BACKOUT_SPEED);
        if (g_forward_progress_mm >= g_target_forward_mm)
        {
          Chassis_Stop();
          EnterState(STATE_RETURN_TURN_LEFT_180);
        }
        else if (StateTimedOut(PUSH_TIMEOUT_MS) != 0U)
        {
          EnterState(STATE_ERROR);
        }
        break;

      /* 再次左转掉头：恢复到最开始正对沙发底的朝向 */
      case STATE_RETURN_TURN_LEFT_180:
        if (entered != 0U)
        {
          Chassis_StartTurnLeft180();
        }
        if (Chassis_RunTurnLeft180() != 0U)
        {
          EnterState(STATE_DONE);
        }
        else if (StateTimedOut(TURN_TIMEOUT_MS) != 0U)
        {
          EnterState(STATE_ERROR);
        }
        break;

      /* 完成阶段：停车，灯带会随状态结束自动熄灭 */
      case STATE_DONE:
        Chassis_Stop();
        break;

      /* 异常阶段：任一步超时或条件异常都进入这里停车 */
      case STATE_ERROR:
      default:
        Chassis_Stop();
        break;
    }

    osDelay(10);
  }
  /* USER CODE END StartMotorTask */
}

   void StartEncoderTask(void const * argument)
  {
    /* USER CODE BEGIN StartEncoderTask */
    uint32_t last_print_tick = 0U;

    (void)argument;
    HAL_TIM_Encoder_Start(&htim2,
  TIM_CHANNEL_ALL);
    HAL_TIM_Encoder_Start(&htim3,
  TIM_CHANNEL_ALL);
    HAL_TIM_Encoder_Start(&htim4,
  TIM_CHANNEL_ALL);
    HAL_TIM_Encoder_Start(&htim5,
  TIM_CHANNEL_ALL);

    for (;;)
    {
      Robot_UpdateEncoderSnapshot();
      Robot_UpdateForwardProgress();

      if ((g_robot_state == STATE_SEARCH_STRAFE)
  &&
          ((HAL_GetTick() - last_print_tick) >=
  100U))
      {
        last_print_tick = HAL_GetTick();
        printf("[STRAFE] cmd=%d | e1=%d e2=%d e3=%d e4=%d\r\n",SEARCH_SPEED,
               g_enc1, g_enc2, g_enc3, g_enc4);
      }

      osDelay(10);
    }
    /* USER CODE END StartEncoderTask */
  }

void StartIMUTask(void const * argument)
{
  /* USER CODE BEGIN StartIMUTask */
  (void)argument;
  
#if ROBOT_SM_TEST_IMU
    /* ===== 状态机逻辑测试桩 BEGIN ===== */
    for (;;)
    {
      osDelay(100);
    }
    /* ===== 状态机逻辑测试桩 END ===== */
#else
	HWT101_Init();
    osDelay(50);
  
	for (;;)
  {
    HWT101_GetValue();
	printf("[IMU] yaw=%.2f\r\n", fAngle[2]);
    osDelay(10);
  }
#endif
  
  /* USER CODE END StartIMUTask */
}


void StartSensorTask(void const * argument)
{
  /* USER CODE BEGIN StartSensorTask */
  
  (void)argument;

#if  ROBOT_SM_TEST_SENSOR
    /* ===== 状态机逻辑测试桩 BEGIN ===== */
    for (;;)
    {
      osDelay(100);
    }
    /* ===== 状态机逻辑测试桩 END ===== */
#else
	uint8_t vl53_ready;

    osDelay(100);
    vl53_ready = (VL53L0X_Init_All() == 0U) ? 1U : 0U;

  for (;;)
  {
    if (vl53_ready != 0U)
    {
      g_dist_left = VL53L0X_ReadDistance(0);
      g_dist_top = VL53L0X_ReadDistance(1);
      g_dist_right = VL53L0X_ReadDistance(2);
    }
    else
    {
      g_dist_left = 9999U;
      g_dist_top = 9999U;
      g_dist_right = 9999U;
    }

    g_dist_front = g_vision_distance;
    g_front_switch_triggered = ((g_bumper_left != 0U) || (g_bumper_right != 0U)) ? 1U : 0U;
    g_grab_switch_front = g_front_switch_triggered;

    if (g_robot_state != STATE_EXIT_STRAIGHT)
    {
      g_exit_confirmed = 0U;
    }

    osDelay(20);
  }

#endif
  
  /* USER CODE END StartSensorTask */
}

  
void StartServoTask(void const * argument)
{
  /* USER CODE BEGIN StartServoTask */
  (void)argument;
 
#if  ROBOT_SM_TEST_SERVO
    /* ===== 状态机逻辑测试桩 BEGIN ===== */
    for (;;)
    {
      osDelay(100);
    }
    /* ===== 状态机逻辑测试桩 END ===== */
#else
 
  TIM8_SwitchToServo();
  HAL_TIM_PWM_Start(&htim8, TIM_CHANNEL_4);
  osDelay(100);

  for (;;)
  {
    if (g_servo_cmd != SERVO_CMD_NONE)
    {
	  printf("[SERVO] cmd=%d start\r\n",
  g_servo_cmd);
      g_servo_busy = 1U;

      TIM8_SwitchToServo();
      HAL_TIM_PWM_Start(&htim8, TIM_CHANNEL_4);
      osDelay(50);

      if (g_servo_cmd == SERVO_CMD_OPEN)
      {
        Servo_Open(1);
      }
      else if (g_servo_cmd == SERVO_CMD_CLOSE)
      {
        Servo_Close(1);
      }

      osDelay(SERVO_MOVE_TIME_MS);
 printf("[SERVO] cmd=%d done\r\n",
  g_servo_cmd);
      g_servo_cmd = SERVO_CMD_NONE;
      g_servo_busy = 0U;
    }

    osDelay(20);
  }
  
 #endif
  /* USER CODE END StartServoTask */
}

 
void StartLedTask(void const * argument)
{
  /* USER CODE BEGIN StartLedTask */
  uint8_t last_light_on;
  uint8_t light_on;
  uint16_t waterfall_index;
  uint16_t tail1_index;
  uint16_t tail2_index;
  uint32_t waterfall_tick;
  uint32_t done_effect_tick;
  uint8_t done_effect_started;
  uint8_t color_phase;
  uint8_t head_r;
  uint8_t head_g;
  uint8_t head_b;
  uint8_t tail1_r;
  uint8_t tail1_g;
  uint8_t tail1_b;
  uint8_t tail2_r;
  uint8_t tail2_g;
  uint8_t tail2_b;

  (void)argument;
  last_light_on = 2U;
  waterfall_index = 0U;
  waterfall_tick = 0U;
  done_effect_tick = 0U;
  done_effect_started = 0U;
  color_phase = 0U;

  TIM8_SwitchToWs2812();
  WS2812_Init();
  WS2812_Clear();
  osDelay(100);

  for (;;)
  {
    light_on = RobotNeedLight();

    if (g_robot_state == STATE_DONE)
    {
      if (done_effect_started == 0U)
      {
        done_effect_started = 1U;
        done_effect_tick = HAL_GetTick();
        waterfall_tick = 0U;
        waterfall_index = 0U;
        color_phase = 0U;
      }

      if ((HAL_GetTick() - done_effect_tick) < 5000U)
      {
        if ((g_servo_busy == 0U) && ((HAL_GetTick() - waterfall_tick) >= 80U))
        {
          waterfall_tick = HAL_GetTick();
          tail1_index = (uint16_t)((waterfall_index + LED_NUM - 1U) % LED_NUM);
          tail2_index = (uint16_t)((waterfall_index + LED_NUM - 2U) % LED_NUM);

          switch (color_phase)
          {
            case 0:
              head_r = 200; head_g = 0;   head_b = 0;
              tail1_r = 80;  tail1_g = 20;  tail1_b = 0;
              tail2_r = 20;  tail2_g = 0;   tail2_b = 0;
              break;
            case 1:
              head_r = 200; head_g = 120; head_b = 0;
              tail1_r = 80;  tail1_g = 40;  tail1_b = 0;
              tail2_r = 20;  tail2_g = 10;  tail2_b = 0;
              break;
            case 2:
              head_r = 180; head_g = 200; head_b = 0;
              tail1_r = 60;  tail1_g = 80;  tail1_b = 0;
              tail2_r = 10;  tail2_g = 20;  tail2_b = 0;
              break;
            case 3:
              head_r = 0;   head_g = 200; head_b = 80;
              tail1_r = 0;   tail1_g = 80;  tail1_b = 30;
              tail2_r = 0;   tail2_g = 20;  tail2_b = 10;
              break;
            case 4:
              head_r = 0;   head_g = 120; head_b = 200;
              tail1_r = 0;   tail1_g = 40;  tail1_b = 80;
              tail2_r = 0;   tail2_g = 10;  tail2_b = 20;
              break;
            default:
              head_r = 180; head_g = 0;   head_b = 200;
              tail1_r = 70;  tail1_g = 0;   tail1_b = 80;
              tail2_r = 20;  tail2_g = 0;   tail2_b = 20;
              break;
          }

          TIM8_SwitchToWs2812();
          WS2812_Clear();
          WS2812_SetLED(tail2_index, tail2_r, tail2_g, tail2_b);
          WS2812_SetLED(tail1_index, tail1_r, tail1_g, tail1_b);
          WS2812_SetLED(waterfall_index, head_r, head_g, head_b);

          waterfall_index = (uint16_t)((waterfall_index + 1U) % LED_NUM);
          color_phase = (uint8_t)((color_phase + 1U) % 6U);
        }
      }
      else
      {
        TIM8_SwitchToWs2812();
        WS2812_Clear();
      }

      last_light_on = 0U;
      osDelay(20);
      continue;
    }
    else
    {
      done_effect_started = 0U;
    }

    if ((g_servo_busy == 0U) && (light_on != last_light_on))
    {
      TIM8_SwitchToWs2812();

      if (light_on != 0U)
      {
        WS2812_SetAll(200, 200, 200);
      }
      else
      {
        WS2812_Clear();
      }

      last_light_on = light_on;
      osDelay(50);
    }

    osDelay(50);
  }
  /* USER CODE END StartLedTask */
}


 void StartCommTask(void const * argument)
  {
    /* USER CODE BEGIN StartCommTask */
    (void)argument;
    
     Robot_VisionRxStart();

    for (;;)
    {
  #if  ROBOT_SM_TEST_COMM
      Robot_StateMachineTestStep();
  #else
      Robot_VisionProtocol_Poll();
  #endif
      osDelay(10);
    }
    /* USER CODE END StartCommTask */
  }

 

/* Private application code --------------------------------------------------*/
/* USER CODE BEGIN Application */
static uint8_t VisionDetectedStable(void)
{
  static uint8_t detect_count = 0;
  static uint32_t last_print_tick = 0U;
  uint8_t vision_hit;

  if (g_robot_state != STATE_SEARCH_STRAFE)
  {
    detect_count = 0;
    last_print_tick = 0U;
    return 0U;
  }

  vision_hit = ((g_vision_detected != 0U) &&
                ((g_vision_raw >= g_vision_raw_trigger) ||
                 (g_vision_smooth >= g_vision_smooth_trigger) ||
                 (g_vision_decision >= g_vision_decision_trigger))) ? 1U : 0U;

  if (vision_hit != 0U)
  {
    if (detect_count < 255U)
    {
      detect_count++;
    }
  }
  else
  {
    detect_count = 0;
  }

#if ROBOT_SM_DEBUG_PRINT
  if ((HAL_GetTick() - last_print_tick) >= 100U)
  {
    last_print_tick = HAL_GetTick();
    printf("[VISION] det=%u smooth=%u raw=%u dec=%u hit=%u cnt=%u/%u\r\n",
           g_vision_detected,
           g_vision_smooth,
           g_vision_raw,
           g_vision_decision,
           vision_hit,
           detect_count,
           g_vision_detect_min_count);
  }
#endif

  return (detect_count >= g_vision_detect_min_count) ? 1U : 0U;
}

static uint16_t Robot_EstimateForwardMm(void)
{
  if (g_vision_smooth >= VISION_NEAR_SMOOTH)
  {
    return VISION_NEAR_TRAVEL_MM;
  }

  if (g_vision_smooth >= VISION_MID_SMOOTH)
  {
    return VISION_MID_TRAVEL_MM;
  }

  return FIXED_TRAVEL_MM;
}

static uint16_t Robot_ComputePushTravelMm(uint16_t forward_mm)
{
  uint16_t divisor;
  uint16_t push_mm;

  divisor = (g_push_distance_divisor == 0U) ? 1U : g_push_distance_divisor;
  push_mm = (uint16_t)(forward_mm / divisor);

  if (push_mm < g_push_distance_min_mm)
  {
    push_mm = g_push_distance_min_mm;
  }

  return push_mm;
}

static uint8_t StateTimedOut(uint32_t timeout_ms)
{
  return ((HAL_GetTick() - g_state_timer) > timeout_ms) ? 1U : 0U;
}

static uint8_t RobotNeedLight(void)
{
  if ((g_robot_state == STATE_BOOT_PREPARE) ||
      (g_robot_state == STATE_SEARCH_STRAFE) ||
      (g_robot_state == STATE_LOCK_TARGET) ||
      (g_robot_state == STATE_FORWARD_TO_TARGET) ||
      (g_robot_state == STATE_GRAB_CLOSE) ||
      (g_robot_state == STATE_TURN_LEFT_180) ||
      (g_robot_state == STATE_EXIT_STRAIGHT) ||
      (g_robot_state == STATE_RELEASE) ||
      (g_robot_state == STATE_PUSH_FORWARD) ||
      (g_robot_state == STATE_PUSH_BACKWARD) ||
      (g_robot_state == STATE_RETURN_TURN_LEFT_180))
  {
    return 1U;
  }

  return 0U;
}

static uint32_t Robot_AbsS32(int32_t value)
{
  return (value >= 0) ? (uint32_t)value : (uint32_t)(-value);
}

static void Robot_ClearFrontSwitchLatch(void)
{
  g_bumper_left = 0U;
  g_bumper_right = 0U;
  g_front_switch_triggered = 0U;
  g_grab_switch_front = 0U;
}

static void Robot_ResetForwardProgress(void)
{
  s_forward_encoder_accum = 0U;
  g_forward_progress_mm = 0U;
}

static void Robot_UpdateEncoderSnapshot(void)
{
  g_enc1 = -Read_Encoder_TIM2();
  g_enc2 = Read_Encoder_TIM3();
  g_enc3 = -Read_Encoder_TIM5();
  g_enc4 = -Read_Encoder_TIM4();
}

static void Robot_UpdateForwardProgress(void)
{
  uint32_t avg_abs_count;

  if ((g_robot_state != STATE_FORWARD_TO_TARGET) &&
      (g_robot_state != STATE_EXIT_STRAIGHT) &&
      (g_robot_state != STATE_PUSH_FORWARD) &&
      (g_robot_state != STATE_PUSH_BACKWARD))
  {
    return;
  }

  avg_abs_count = (Robot_AbsS32(g_enc1) +
                   Robot_AbsS32(g_enc2) +
                   Robot_AbsS32(g_enc3) +
                   Robot_AbsS32(g_enc4)) / 4U;

  s_forward_encoder_accum += avg_abs_count;
  g_forward_progress_mm = (uint16_t)((float)s_forward_encoder_accum * ENCODER_MM_PER_COUNT);
}

static void Robot_VisionRxStart(void)
{
  s_vision_rx_ready = 0U;
  s_vision_rx_size = 0U;

  __HAL_UART_CLEAR_PEFLAG(&huart3);
  __HAL_UART_CLEAR_FEFLAG(&huart3);
  __HAL_UART_CLEAR_NEFLAG(&huart3);
  __HAL_UART_CLEAR_OREFLAG(&huart3);

  huart3.ReceptionType = HAL_UART_RECEPTION_STANDARD;
  huart3.RxState = HAL_UART_STATE_READY;

  HAL_UARTEx_ReceiveToIdle_IT(&huart3, s_vision_rx_buf, VISION_RX_BUF_SIZE);
}

static uint8_t Robot_ParseVisionScore(const char *token, uint16_t *out_value)
{
  long value;
  char *endptr;

  if ((token == NULL) || (out_value == NULL) || (*token == '\0'))
  {
    return 0U;
  }

  value = strtol(token, &endptr, 10);
  if ((endptr == token) || ((*endptr != '\0') && (*endptr != '\r') && (*endptr != '\n')))
  {
    return 0U;
  }

  if (value < 0L)
  {
    value = 0L;
  }
  else if (value > VISION_SCORE_MAX)
  {
    value = VISION_SCORE_MAX;
  }

  *out_value = (uint16_t)value;
  return 1U;
}

static void Robot_ResetVisionData(void)
{
  g_vision_detected = 0U;
  g_vision_position = 0U;
  g_vision_distance = 0U;
  g_vision_smooth = 0U;
  g_vision_raw = 0U;
  g_vision_decision = 0U;
}

static void EnterState(RobotState_t next_state)
{
  g_robot_state = next_state;
  g_state_timer = HAL_GetTick();

#if ROBOT_SM_DEBUG_PRINT
  printf("[STATE] %s | vision=%u dist=%u forward=%u close=%d exit=%u\r\n",
         Robot_StateName(next_state),
         g_vision_detected,
         g_vision_distance,
         g_forward_progress_mm,
         g_close_reason,
         g_exit_confirmed);
#endif
}
  
void Robot_VisionProtocol_Poll(void)
{
  char line[VISION_RX_BUF_SIZE];
  char raw_line[VISION_RX_BUF_SIZE];
  char *token;
  char *ctx = NULL;
  uint16_t copy_len;
  uint16_t smooth = 0U;
  uint16_t raw = 0U;
  uint16_t decision = 0U;
  uint8_t clutter_flag = 0U;
  uint8_t parse_ok;

  if (s_vision_rx_ready == 0U)
  {
    return;
  }

  s_vision_rx_ready = 0U;
  copy_len = s_vision_rx_size;

  if ((copy_len == 0U) || (copy_len >= VISION_RX_BUF_SIZE))
  {
#if ROBOT_SM_DEBUG_PRINT
    printf("[VISION_ERR] bad_len=%u\r\n", copy_len);
#endif
    Robot_ResetVisionData();
    Robot_VisionRxStart();
    return;
  }

  memcpy(line, s_vision_rx_buf, copy_len);
  line[copy_len] = '\0';
  line[strcspn(line, "\r\n")] = '\0';
  strncpy(raw_line, line, sizeof(raw_line) - 1U);
  raw_line[sizeof(raw_line) - 1U] = '\0';

  if (line[0] == '\0')
  {
#if ROBOT_SM_DEBUG_PRINT
    printf("[VISION_ERR] empty_frame\r\n");
#endif
    Robot_ResetVisionData();
    Robot_VisionRxStart();
    return;
  }

  token = strtok_r(line, ",", &ctx);
  if ((token == NULL) || (strcmp(token, "$SWEEP") != 0))
  {
#if ROBOT_SM_DEBUG_PRINT
    printf("[VISION_ERR] bad_head raw=%s\r\n", raw_line);
#endif
    Robot_ResetVisionData();
    Robot_VisionRxStart();
    return;
  }

  token = strtok_r(NULL, ",", &ctx);
  if (token == NULL)
  {
#if ROBOT_SM_DEBUG_PRINT
    printf("[VISION_ERR] missing_flag raw=%s\r\n", raw_line);
#endif
    Robot_ResetVisionData();
    Robot_VisionRxStart();
    return;
  }

  if ((strcmp(token, "0") == 0) || (strcmp(token, "1") == 0))
  {
    clutter_flag = (uint8_t)(token[0] - '0');
  }
  else
  {
#if ROBOT_SM_DEBUG_PRINT
    printf("[VISION_ERR] bad_flag raw=%s\r\n", raw_line);
#endif
    Robot_ResetVisionData();
    Robot_VisionRxStart();
    return;
  }

  token = strtok_r(NULL, ",", &ctx);
  parse_ok = Robot_ParseVisionScore(token, &smooth);
  if (parse_ok == 0U)
  {
#if ROBOT_SM_DEBUG_PRINT
    printf("[VISION_ERR] bad_smooth raw=%s\r\n", raw_line);
#endif
    Robot_ResetVisionData();
    Robot_VisionRxStart();
    return;
  }

  token = strtok_r(NULL, ",", &ctx);
  parse_ok = Robot_ParseVisionScore(token, &raw);
  if (parse_ok == 0U)
  {
#if ROBOT_SM_DEBUG_PRINT
    printf("[VISION_ERR] bad_raw raw=%s\r\n", raw_line);
#endif
    Robot_ResetVisionData();
    Robot_VisionRxStart();
    return;
  }

  token = strtok_r(NULL, ",", &ctx);
  parse_ok = Robot_ParseVisionScore(token, &decision);
  if (parse_ok == 0U)
  {
#if ROBOT_SM_DEBUG_PRINT
    printf("[VISION_ERR] bad_decision raw=%s\r\n", raw_line);
#endif
    Robot_ResetVisionData();
    Robot_VisionRxStart();
    return;
  }

  g_vision_detected = clutter_flag;
  g_vision_position = clutter_flag;
  g_vision_smooth = smooth;
  g_vision_raw = raw;
  g_vision_decision = decision;
  g_vision_distance = (clutter_flag != 0U) ? Robot_EstimateForwardMm() : 0U;

#if ROBOT_SM_DEBUG_PRINT
  printf("[VISION_RX] flag=%u smooth=%u raw=%u dec=%u dist=%u\r\n",
         g_vision_detected,
         g_vision_smooth,
         g_vision_raw,
         g_vision_decision,
         g_vision_distance);
#endif

  Robot_VisionRxStart();
}

#if ROBOT_SM_TEST_STUB
static void Robot_StateMachineTestStep(void)
{
  static RobotState_t last_state = STATE_ERROR;
  static uint32_t state_tick = 0U;

  if (g_robot_state != last_state)
  {
    last_state = g_robot_state;
    state_tick = HAL_GetTick();
  }

  switch (g_robot_state)
  {
    case STATE_BOOT_PREPARE:
      g_vision_detected = 0U;
      g_vision_distance = 0U;
      g_vision_smooth = 0U;
      g_vision_raw = 0U;
      g_vision_decision = 0U;
      g_forward_progress_mm = 0U;
      g_exit_confirmed = 0U;
      g_servo_busy = 0U;
      g_servo_cmd = SERVO_CMD_NONE;
      break;

    case STATE_SEARCH_STRAFE:
      g_vision_detected = 1U;
      g_vision_smooth = 620U;
      g_vision_raw = 420U;
      g_vision_decision = 650U;
      g_vision_distance = Robot_EstimateForwardMm();
      break;

    case STATE_LOCK_TARGET:
      g_vision_detected = 1U;
      g_vision_smooth = 780U;
      g_vision_raw = 500U;
      g_vision_decision = 800U;
      g_vision_distance = Robot_EstimateForwardMm();
      break;

    case STATE_FORWARD_TO_TARGET:
      if (g_forward_progress_mm < g_target_forward_mm)
      {
        g_forward_progress_mm += 20U;
      }
      break;

    case STATE_GRAB_CLOSE:
      if ((HAL_GetTick() - state_tick) < 50U)
      {
        g_servo_busy = 1U;
      }
      else if ((HAL_GetTick() - state_tick) > 300U)
      {
        g_servo_busy = 0U;
        g_servo_cmd = SERVO_CMD_NONE;
      }
      break;

    case STATE_TURN_LEFT_180:
      if ((HAL_GetTick() - state_tick) > 300U)
      {
        EnterState(STATE_RELEASE);
      }
      break;

    case STATE_EXIT_STRAIGHT:
      if ((HAL_GetTick() - state_tick) > 300U)
      {
        g_exit_confirmed = 1U;
      }
      break;

    case STATE_RELEASE:
      if ((HAL_GetTick() - state_tick) < 50U)
      {
        g_servo_busy = 1U;
      }
      else if ((HAL_GetTick() - state_tick) > 300U)
      {
        g_servo_busy = 0U;
        g_servo_cmd = SERVO_CMD_NONE;
      }
      break;

    case STATE_PUSH_FORWARD:
      if (g_forward_progress_mm < g_target_forward_mm)
      {
        g_forward_progress_mm += 20U;
      }
      break;

    case STATE_PUSH_BACKWARD:
      if (g_forward_progress_mm < g_target_forward_mm)
      {
        g_forward_progress_mm += 20U;
      }
      break;

    case STATE_RETURN_TURN_LEFT_180:
      if ((HAL_GetTick() - state_tick) > 300U)
      {
        EnterState(STATE_DONE);
      }
      break;

    case STATE_DONE:
    case STATE_ERROR:
    default:
      break;
  }
}
#endif

void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart, uint16_t Size)
{
  if (huart->Instance == USART3)
  {
    if (Size > VISION_RX_BUF_SIZE)
    {
      Size = VISION_RX_BUF_SIZE;
    }

#if ROBOT_SM_DEBUG_PRINT
    printf("[UART3_IRQ] size=%u\r\n", Size);
#endif

    s_vision_rx_size = Size;
    s_vision_rx_ready = 1U;
  }
}

static const char *Robot_StateName(RobotState_t state)
{
  switch (state)
  {
    case STATE_BOOT_PREPARE:      return "BOOT_PREPARE";
    case STATE_SEARCH_STRAFE:     return "SEARCH_STRAFE";
    case STATE_LOCK_TARGET:       return "LOCK_TARGET";
    case STATE_FORWARD_TO_TARGET: return "FORWARD_TO_TARGET";
    case STATE_GRAB_CLOSE:        return "GRAB_CLOSE";
    case STATE_TURN_LEFT_180:     return "TURN_LEFT_180";
    case STATE_EXIT_STRAIGHT:     return "EXIT_STRAIGHT";
    case STATE_RELEASE:           return "RELEASE";
    case STATE_PUSH_FORWARD:      return "PUSH_FORWARD";
    case STATE_PUSH_BACKWARD:     return "PUSH_BACKWARD";
    case STATE_RETURN_TURN_LEFT_180: return "RETURN_TURN_LEFT_180";
    case STATE_DONE:              return "DONE";
    case STATE_ERROR:             return "ERROR";
    default:                      return "UNKNOWN";
  }
}

/* USER CODE END Application */
 
