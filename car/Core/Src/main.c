/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : Main program body
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2026 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */
/* USER CODE END Header */
/* Includes ------------------------------------------------------------------*/
#include "main.h"
#include "cmsis_os.h"
#include "dma.h"
#include "i2c.h"
#include "tim.h"
#include "usart.h"
#include "gpio.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include <stdio.h>
#include "ws2812b.h"
#include "encoder.h"
#include "motor.h"
#include "servo.h"
#include "vl53l0x.h"
#include "robot.h"
#include "chassis.h"
#include "HWT101.h"

/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */

/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */

/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/

/* USER CODE BEGIN PV */
volatile uint16_t g_vision_detect_min_count = 2U;
volatile uint16_t g_vision_raw_trigger = 380U;
volatile uint16_t g_vision_smooth_trigger = 550U;
volatile uint16_t g_vision_decision_trigger = 600U;
volatile uint16_t g_push_distance_divisor = 2U;
volatile uint16_t g_push_distance_min_mm = 50U;
/*
 * 比赛调参接口：以后优先只改这里
 * g_vision_detect_min_count:
 *   1 = 更灵敏，更容易触发；2 = 默认；3 = 更稳，但更容易错过
 * g_vision_raw_trigger / g_vision_smooth_trigger / g_vision_decision_trigger:
 *   数值越小越松，越大越严
 *   推荐先调 detect_min_count，再调 decision_trigger，最后微调 raw/smooth
 * g_push_distance_divisor:
 *   推出距离 = 本次抓取前进距离 / divisor，默认 2 表示一半
 * g_push_distance_min_mm:
 *   推出距离下限，避免一半后太短
 */
// volatile uint16_t g_laser_distance_mm = 0;

//  uint8_t s_laser_rx_buf[32];
//  volatile uint16_t s_laser_rx_size = 0;
//  volatile uint8_t s_laser_rx_ready = 0;
/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
void MX_FREERTOS_Init(void);
/* USER CODE BEGIN PFP */
// static void Laser_RxStart(void);
//  static void Laser_Poll(void);
/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */
//static void Laser_RxStart(void)
//  {
//    s_laser_rx_ready = 0;
//    s_laser_rx_size = 0;
//    HAL_UARTEx_ReceiveToIdle_IT(&huart1,
//  s_laser_rx_buf, sizeof(s_laser_rx_buf));
//  }

//  static void Laser_Poll(void)
//  {
//    char line[32];
//    char *p;
//    uint16_t copy_len;

//    if (s_laser_rx_ready == 0U)
//    {
//      return;
//    }

//    s_laser_rx_ready = 0U;

//    copy_len = s_laser_rx_size;
//    if (copy_len >= sizeof(line))
//    {
//      copy_len = sizeof(line) - 1U;
//    }

//    memcpy(line, s_laser_rx_buf, copy_len);
//    line[copy_len] = '\0';

//    p = line;
//    while ((*p != '\0') && (*p < '0' || *p >
//  '9'))
//    {
//      p++;
//    }

//    if (*p != '\0')
//    {
//      g_laser_distance_mm = (uint16_t)atoi(p);
//    }

//    Laser_RxStart();
//  }

//  void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef
//  *huart, uint16_t Size)
//  {
//    if (huart->Instance == USART1)
//    {
//      if (Size >= sizeof(s_laser_rx_buf))
//      {
//        Size = sizeof(s_laser_rx_buf) - 1U;
//      }

//      s_laser_rx_size = Size;
//      s_laser_rx_ready = 1U;
//    }
//  }
 static float NormalizeAngle180(float angle)
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
/* USER CODE END 0 */

/**
  * @brief  The application entry point.
  * @retval int
  */
int main(void)
{

  /* USER CODE BEGIN 1 */
	
	/* ������ִ�У�����JTAG����SWD�����������г�ʼ��֮ǰ */
  __HAL_RCC_AFIO_CLK_ENABLE();
  __HAL_AFIO_REMAP_SWJ_NOJTAG();
 

	/* ����DWT�����������ڶ��΢�����? */
	CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
	DWT->CYCCNT = 0;
	DWT->CTRL  |= DWT_CTRL_CYCCNTENA_Msk;
  /* USER CODE END 1 */

  /* MCU Configuration--------------------------------------------------------*/

  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* Configure the system clock */
  SystemClock_Config();

  /* USER CODE BEGIN SysInit */

  /* USER CODE END SysInit */

  /* Initialize all configured peripherals */
  MX_GPIO_Init();
  MX_DMA_Init();
  MX_I2C1_Init();
  MX_I2C2_Init();
  MX_TIM1_Init();
  MX_TIM2_Init();
  MX_TIM3_Init();
  MX_TIM4_Init();
  MX_TIM5_Init();
  MX_TIM8_Init();
  MX_USART1_UART_Init();
  MX_USART2_UART_Init();
  MX_USART3_UART_Init();
  MX_UART4_Init();
  MX_UART5_Init();
   
   
  /* USER CODE BEGIN 2 */
 printf("uart printf ok\r\n");
  
  /* Call init function for freertos objects (in cmsis_os2.c) */
  MX_FREERTOS_Init();

  /* Start scheduler */
  osKernelStart();

  /* We should never get here as control is now taken by the scheduler */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  while (1)
  {
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */
  }
  /* USER CODE END 3 */
}

/**
  * @brief System Clock Configuration
  * @retval None
  */
void SystemClock_Config(void)
{
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

  /** Initializes the RCC Oscillators according to the specified parameters
  * in the RCC_OscInitTypeDef structure.
  */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSE;
  RCC_OscInitStruct.HSEState = RCC_HSE_ON;
  RCC_OscInitStruct.HSEPredivValue = RCC_HSE_PREDIV_DIV1;
  RCC_OscInitStruct.HSIState = RCC_HSI_ON;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
  RCC_OscInitStruct.PLL.PLLMUL = RCC_PLL_MUL9;
  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
  {
    Error_Handler();
  }

  /** Initializes the CPU, AHB and APB buses clocks
  */
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV2;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;

  if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_2) != HAL_OK)
  {
    Error_Handler();
  }
}

/* USER CODE BEGIN 4 */

/* USER CODE END 4 */

/**
  * @brief  Period elapsed callback in non blocking mode
  * @note   This function is called  when TIM6 interrupt took place, inside
  * HAL_TIM_IRQHandler(). It makes a direct call to HAL_IncTick() to increment
  * a global variable "uwTick" used as application time base.
  * @param  htim : TIM handle
  * @retval None
  */
void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim)
{
  /* USER CODE BEGIN Callback 0 */

  /* USER CODE END Callback 0 */
  if (htim->Instance == TIM6) {
    HAL_IncTick();
  }
  /* USER CODE BEGIN Callback 1 */

  /* USER CODE END Callback 1 */
}

/**
  * @brief  This function is executed in case of error occurrence.
  * @retval None
  */
void Error_Handler(void)
{
  /* USER CODE BEGIN Error_Handler_Debug */
  /* User can add his own implementation to report the HAL error return state */
  __disable_irq();
  while (1)
  {
  }
  /* USER CODE END Error_Handler_Debug */
}

#ifdef  USE_FULL_ASSERT
/**
  * @brief  Reports the name of the source file and the source line number
  *         where the assert_param error has occurred.
  * @param  file: pointer to the source file name
  * @param  line: assert_param error line source number
  * @retval None
  */
void assert_failed(uint8_t *file, uint32_t line)
{
  /* USER CODE BEGIN 6 */
  /* User can add his own implementation to report the file name and line number,
     ex: printf("Wrong parameters value: file %s on line %d\r\n", file, line) */
  /* USER CODE END 6 */
}
#endif /* USE_FULL_ASSERT */
